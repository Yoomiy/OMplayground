export function HexGLSolo() {
  return (
    <section
      className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-play"
      dir="ltr"
    >
      <h2 className="text-center text-lg font-bold text-slate-900">מרוץ מכוניות</h2>
      <p className="text-center text-sm font-medium text-slate-600">
        מירוץ תלת-ממדי מהיר בעולם עתידני. השתמשו במקלדת כדי לשחק.
      </p>
      <div className="relative mx-auto h-[640px] w-full max-w-[1024px] overflow-hidden rounded-3xl border border-slate-200 bg-black shadow-play">
        <iframe
          title="HexGL"
          src="/legacy/hexgl/index.html"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}
