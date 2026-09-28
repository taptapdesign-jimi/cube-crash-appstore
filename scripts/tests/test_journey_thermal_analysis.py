import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).parents[1] / 'analyze-journey-thermal-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AnalysisTest(unittest.TestCase):
    def test_known_drop_and_missing_suppression_proof(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p / 'toc.xml').write_text('<trace-toc><summary><start-date>1970-01-01T00:00:00+00:00</start-date></summary></trace-toc>')
            events = []
            rows = []
            for phase in range(4):
                start = 5000 + phase * 25000
                suppressed = phase in [1, 2]
                events.extend([
                    {'event': 'measure-start', 'run': 'a', 'phase': phase, 'wall': start},
                    {'event': 'measure-end', 'run': 'a', 'phase': phase, 'wall': start + 20000,
                     'group': 'ambient', 'suppressed': suppressed,
                     'counts': {'ambient': {'suppressed': 20 if suppressed else 0}}},
                ])
                for i in range(20):
                    rows.append(f'<row><time>{(start+i*1000)*1000000}</time><process fmt="game (7)"><pid>7</pid></process><weight>{50000000 if suppressed else 100000000}</weight></row>')
            rows.extend(['<row><time>0</time><process fmt="other"><pid>8</pid></process><weight>1</weight></row>', '<row><time>110000000000</time><process fmt="other"><pid>8</pid></process><weight>1</weight></row>'])
            schema = '<schema>' + ''.join(f'<col><mnemonic>{name}</mnemonic></col>' for name in ['time', 'process', 'weight']) + '</schema>'
            (p / 'cpu.xml').write_text('<root>'+schema+''.join(rows)+'</root>')
            def run():
                (p / 'console.log').write_text('\n'.join('[CC_THERMAL_ISOLATION] '+json.dumps(e) for e in events))
                return audit.analyze(p/'console.log', p/'cpu.xml', p/'toc.xml', {7})['groups']['ambient']
            result = run()
            self.assertEqual(result['verdict'], 'COMPARABLE_CPU_WINDOWS')
            self.assertAlmostEqual(result['relativeDropPercent'], 50)
            events[3]['counts'] = {}
            self.assertEqual(run()['verdict'], 'INCOMPLETE_OR_UNVERIFIED')


if __name__ == '__main__':
    unittest.main()
