import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('power', Path(__file__).parents[1] / 'analyze-unplugged-world-power.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PowerAnalysis(unittest.TestCase):
    def test_real_units_phase_coverage_and_static_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'toc.xml').write_text('<trace-toc><start-date>1970-01-01T00:00:00+00:00</start-date></trace-toc>')
            events = [{'event': 'start', 'run': 'test'}]
            rows = []
            for phase in range(4):
                start = phase * 180000 + 20000
                static = phase in (0, 3)
                common = {'run': 'test', 'phase': phase, 'suppressed': static,
                          'native': {'batteryState': 1, 'persistenceAvailable': True, 'thermalState': 'nominal'}}
                events += [{**common, 'event': 'measure-start', 'wall': start},
                           {**common, 'event': 'measure-end', 'wall': start + 165000,
                            'staticSampledVerified': static, 'counts': {owner: {'suppressed': 10} for owner in ('ambient', 'journey-units')}}]
                for ms in range(start, start + 165000, 1000):
                    rows.append(f'<row><n>{ms * 1000000}</n><n>1000000000</n><n>{10 if static else 20}</n><n>55</n></row>')
            events.append({'event': 'stop', 'run': 'test', 'complete': True})
            def write_events():
                (root / 'log').write_text('\n'.join('[CC_THERMAL_ISOLATION] ' + json.dumps({**event, 'protocol': 'unplugged-static-animated-static'}) for event in events))
            write_events()
            (root / 'power.xml').write_text('<data><schema>' + ''.join(f'<col><mnemonic>{key}</mnemonic><engineering-type>{unit}</engineering-type></col>' for key, unit in [('start', 'start-time'), ('duration', 'duration'), ('power-usage', 'percent-per-hour'), ('display-brightness', 'display-brightness')]) + '</schema>' + ''.join(rows) + '</data>')
            args = [root / name for name in ('log', 'toc.xml', 'power.xml')]
            result = module.analyze(*args)
            self.assertEqual(result['verdict'], 'VALID_COMPARISON')
            self.assertEqual(result['animatedMinusStatic'], 10)
            events[2]['staticSampledVerified'] = False
            write_events()
            with self.assertRaisesRegex(ValueError, 'Static scene'):
                module.analyze(*args)
            events[2]['staticSampledVerified'] = True
            events.pop()
            write_events()
            with self.assertRaisesRegex(ValueError, 'Incomplete'):
                module.analyze(*args)


if __name__ == '__main__':
    unittest.main()
