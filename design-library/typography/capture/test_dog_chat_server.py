"""Real loopback HTTP tests; upstream AI is mocked, never charged or called."""
import importlib.util,json,threading,unittest,io
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('design_server',Path(__file__).resolve().parents[1]/'serve.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);cls.origin=f'http://127.0.0.1:{cls.server.server_port}';cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=3)
    def setUp(self):app.KEY='';app.MODEL='gpt-5.4-mini'
    def post(self,path,body,origin=None,token=None):
        request=Request(self.origin+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':origin or self.origin,'X-Design-Token':token or app.TOKEN},method='POST')
        try:
            with urlopen(request,timeout=4) as r:return r.status,json.load(r)
        except HTTPError as e:return e.code,json.load(e)
    def test_status_and_disconnected_chat(self):
        with urlopen(self.origin+'/api/assistant/status') as r:status=json.load(r)
        self.assertFalse(status['ready']);self.assertNotIn('key',status)
        code,_=self.post('/api/assistant/chat',{'message':'usporedi'});self.assertEqual(code,503)
    def test_origin_and_token_required(self):
        self.assertEqual(self.post('/api/assistant/connect',{'key':'x'*30,'model':'gpt-5.4-mini'},origin='https://example.org')[0],403)
        self.assertEqual(self.post('/api/assistant/connect',{'key':'x'*30,'model':'gpt-5.4-mini'},token='wrong')[0],403)
        self.assertEqual(app.KEY,'')
    def test_connect_disconnect_does_not_persist_key(self):
        self.assertEqual(self.post('/api/assistant/connect',{'key':'test-credential-ephemeral','model':'gpt-5.4-mini'})[0],200)
        self.assertEqual(app.KEY,'test-credential-ephemeral')
        self.assertEqual(self.post('/api/assistant/disconnect',{})[0],200);self.assertEqual(app.KEY,'')
    def test_answer_uses_canonical_catalog_and_filters_unknown_ids(self):
        app.KEY='test-only';captured={}
        def fake(request,timeout):
            captured.update(json.loads(request.data));answer={'reply':'Naslov je 28 px.','highlight_ids':['settings-text-1','invented-id']}
            return io.BytesIO(json.dumps({'output':[{'content':[{'type':'output_text','text':json.dumps(answer)}]}]}).encode())
        with patch.object(app,'urlopen',fake):code,answer=self.post('/api/assistant/chat',{'message':'usporedi','selected_id':'settings-text-1','history':[{'role':'system','content':'ignored'}]})
        self.assertEqual(code,200);self.assertEqual(answer['highlight_ids'],['settings-text-1']);self.assertFalse(captured['store']);self.assertEqual(len(captured['input']),1);self.assertIn('settings-text-1',captured['instructions'])
    def test_transcription_multipart_and_response(self):
        app.KEY='test-only';captured={}
        def fake(request,timeout):
            captured['url']=request.full_url;captured['body']=request.data
            return io.BytesIO(json.dumps({'text':'Usporedi ovaj naslov.'}).encode())
        request=Request(self.origin+'/api/assistant/transcribe',data=b'test-audio',headers={'Content-Type':'audio/webm','Origin':self.origin,'X-Design-Token':app.TOKEN},method='POST')
        with patch.object(app,'urlopen',fake):
            with urlopen(request,timeout=4) as r:answer=json.load(r)
        self.assertEqual(answer['text'],'Usporedi ovaj naslov.');self.assertIn(b'test-audio',captured['body']);self.assertTrue(captured['url'].endswith('/audio/transcriptions'))
    def test_busy_and_invalid_input_are_bounded(self):
        self.assertEqual(self.post('/api/assistant/chat',{'message':'x'*4001})[0],400)
        app.KEY='test-only';app.BUSY.acquire()
        try:self.assertEqual(self.post('/api/assistant/chat',{'message':'usporedi'})[0],429)
        finally:app.BUSY.release()
if __name__=='__main__':unittest.main()
