export type TimingProfileName = 'baseline' | 'buffer' | 'clock' | 'combined';

/** Lab-only comparisons; ordinary visits use the presentation buffer alone. */
export function readTimingProfile(search: string): {
  name: TimingProfileName; autonomous: boolean; poseBufferMs: 0 | 50;
} {
  const requested = new URLSearchParams(search).get('timing');
  const name: TimingProfileName = requested === 'baseline' || requested === 'clock'
    || requested === 'combined' ? requested : 'buffer';
  return { name, autonomous: name === 'clock' || name === 'combined',
    poseBufferMs: name === 'buffer' || name === 'combined' ? 50 : 0 };
}
