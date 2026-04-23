export function HexGLSolo() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-3" dir="ltr">
      <h2 className="text-center text-lg font-semibold text-slate-100">מרוץ מכוניות</h2>
      <p className="text-center text-sm text-slate-300">
        מירוץ תלת-ממדי מהיר בעולם עתידני. השתמשו במקלדת כדי לשחק.
      </p>
      <div className="relative mx-auto h-[640px] w-full max-w-[1024px] overflow-hidden rounded-lg border border-slate-700 bg-black">
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
