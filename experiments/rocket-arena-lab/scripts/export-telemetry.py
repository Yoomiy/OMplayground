#!/usr/bin/env python3
"""Export browser downloads or journal JSONL; keep runs/modes/builds/rooms separate."""
import argparse
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path


def read_windows(path):
    text = Path(path).read_text()
    traces = []
    try:
        downloaded = json.loads(text)
    except ValueError:
        downloaded = None
    if isinstance(downloaded, list):
        rows = downloaded
    else:
        rows = []
        for line in text.splitlines():
            try:
                message = json.loads(line).get('MESSAGE', '') if line.startswith('{') else line
                if not isinstance(message, str):
                    continue
                if '[DrivingLabV2] ' in message:
                    rows.append(json.loads(message.split('[DrivingLabV2] ', 1)[1]))
                elif '[DrivingLabStall] ' in message:
                    traces.append(json.loads(message.split('[DrivingLabStall] ', 1)[1]))
            except (ValueError, AttributeError):
                continue
    seen = set()
    result = []
    for row in rows:
        if row.get('version') != 2:
            continue
        key = (row['runId'], row['windowSequence'], row.get('roomId'), row.get('serverRelease', row['release']))
        if key not in seen:
            result.append(row)
            seen.add(key)
    by_window = {(row['runId'], row['windowSequence'], row.get('roomId'), row.get('serverRelease', row['release'])): row
                 for row in result}
    seen_traces = set()
    for trace in traces:
        key = (trace['runId'], trace['windowSequence'], trace.get('roomId'), trace.get('serverRelease', trace['release']))
        unique = (*key, trace['incidentIndex'])
        if key in by_window and unique not in seen_traces:
            by_window[key].setdefault('stallIncidents', []).append(trace['incident'])
            seen_traces.add(unique)
    return result


def summarize(rows):
    groups = defaultdict(list)
    for row in rows:
        if (row['source'] == 'browser' and row['focused'] and row['visibility'] == 'visible'
                and row['phase'] in ('playing', 'overtime') and row['frames'] > 0):
            key = (row['runId'], row['release'], row.get('serverRelease', row['release']),
                   row.get('roomId', 'download'), row['mode'], row['players'],
                   row.get('graphicsQuality', 'legacy'), row.get('renderScale', 1), row.get('shadows', False), row.get('ceilingEffect', 'legacy'),
                   row.get('timingProfile', 'legacy'), row.get('inputClock', 'legacy'), row.get('poseBufferMs', 'legacy'), row.get('carRendering', 'legacy'),
                   row.get('uiLanguage', 'legacy'), row.get('playerLabels', 'legacy'))
            groups[key].append(row)
    summaries = []
    for key, windows in sorted(groups.items()):
        frames = sum(w['frames'] for w in windows)
        frame_ms = sum(w['frameMs']['mean'] * w['frameMs']['count'] for w in windows)
        eligible = sum(w['eligibleMs'] for w in windows)
        active = sum(w['predictionActiveMs'] for w in windows)
        counts = {reason: sum(w['recoveryCounts'][reason] for w in windows)
                  for reason in windows[0]['recoveryCounts']}
        summary = dict(zip(('runId', 'clientRelease', 'serverRelease', 'roomId', 'mode', 'players', 'graphicsQuality', 'renderScale', 'shadows', 'ceilingEffect', 'timingProfile', 'inputClock', 'poseBufferMs', 'carRendering', 'uiLanguage', 'playerLabels'), key))
        summary['stallIncidents'] = [incident for w in windows for incident in w.get('stallIncidents', [])]
        summary.update(windows=len(windows), frames=frames, measuredSeconds=frame_ms / 1000,
                       fps=1000 * frames / frame_ms if frame_ms else None,
                       predictionActivePercent=100 * active / eligible if eligible else None,
                       frameWindowP95UpperMedianMs=statistics.median(w['frameMs']['p95Upper'] for w in windows),
                       frameMaxMs=max(w['frameMs']['max'] for w in windows),
                       framesOver50ms=sum(w['framesOver50ms'] for w in windows),
                       recoveryCounts=counts, pendingMax=max(w['pendingMax'] for w in windows),
                       carCorrectionsOver10cm=sum(w['carCorrectionsOver10cm'] for w in windows),
                       carCorrectionsOver50cm=sum(w['carCorrectionsOver50cm'] for w in windows),
                       hardSnaps=sum(w['hardSnaps'] for w in windows))
        for field in ('predictionChecks', 'confirmedSnapshots', 'skippedReplaySteps', 'replayedSteps', 'historyMisses', 'historyMismatches'):
            summary[field] = sum(w.get(field, 0) for w in windows)
        for field in ('predictionLagMax', 'predictionResultAgeMaxMs', 'predictionSampleAgeMaxMs'):
            summary[field] = max(w.get(field, 0) for w in windows)
        summary['catchupYields'] = sum(w.get('catchupYields', 0) for w in windows)
        summary['unalignedCorrections'] = sum(w.get('unalignedCorrections', 0) for w in windows)
        for name in ('carCorrectionMeters', 'ballCorrectionMeters', 'rotationCorrectionDegrees', 'replayMs', 'rtt'):
            samples = sum(w[name]['count'] for w in windows)
            summary[name] = dict(count=samples,
                mean=sum(w[name]['mean'] * w[name]['count'] for w in windows) / samples if samples else None,
                max=max(w[name]['max'] for w in windows))
        timed = [w['clientTimings'] for w in windows if 'clientTimings' in w]
        if timed:
            summary['clientTimings'] = {'drawCallsMax': max(w['drawCallsMax'] for w in timed)}
            for name in ('renderSubmitMs', 'sceneEffectsMs', 'presentationMs', 'hudAudioMs', 'workerRoundTripMs', 'poseAgeMs'):
                count = sum(w[name]['count'] for w in timed)
                summary['clientTimings'][name] = dict(count=count,
                    mean=sum(w[name]['mean']*w[name]['count'] for w in timed)/count if count else None,
                    max=max(w[name]['max'] for w in timed))
        summaries.append(summary)
    return summaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', help='Downloaded JSON or journalctl -o json output')
    parser.add_argument('--output', default='.run/telemetry', help='Output file prefix')
    args = parser.parse_args()
    rows = read_windows(args.input)
    prefix = Path(args.output)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    Path(str(prefix) + '-windows.json').write_text(json.dumps(rows, indent=2) + '\n')
    fields = sorted({key for row in rows for key in row})
    with Path(str(prefix) + '-windows.csv').open('w') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows({key: json.dumps(value) if isinstance(value, (dict, list)) else value
                         for key, value in row.items()} for row in rows)
    summaries = summarize(rows)
    Path(str(prefix) + '-summary.json').write_text(json.dumps(summaries, indent=2) + '\n')
    print(json.dumps(dict(windows=len(rows), foregroundGroups=len(summaries), output=str(prefix))))


if __name__ == '__main__':
    main()
