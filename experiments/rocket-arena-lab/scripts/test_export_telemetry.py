"""Journal/raw-log traces join the same metric window as browser downloads."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).with_name('export-telemetry.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTests(unittest.TestCase):
    def test_download_raw_and_journal_with_deduplicated_trace(self):
        window = dict(version=2, runId='run', windowSequence=1, release='test', serverRelease='test', roomId='room')
        incident = dict(event='fallback', targetGapMeters=.1, samples=[dict(timeMs=100)])
        trace = dict(runId='run', windowSequence=1, release='test', serverRelease='test', roomId='room',
                     incidentIndex=0, incident=incident)
        metric_line = '[DrivingLabV2] ' + json.dumps(window)
        trace_line = '[DrivingLabStall] ' + json.dumps(trace)
        expected = [{**window, 'stallIncidents': [incident]}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'input'
            for text in [json.dumps(expected),
                         '[Rocket Arena] startup\n' + '\n'.join([metric_line, trace_line, metric_line, trace_line]),
                         '\n'.join(json.dumps(dict(MESSAGE=line)) for line in [trace_line, metric_line, trace_line])]:
                path.write_text(text)
                self.assertEqual(exporter.read_windows(path), expected)

    def test_non_text_journal_messages_are_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'input'
            path.write_text('\n'.join(json.dumps(dict(MESSAGE=value)) for value in [None, [255, 0], 123]))
            self.assertEqual(exporter.read_windows(path), [])


if __name__ == '__main__':
    unittest.main()
