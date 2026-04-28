export function AlgesEscapadeSolo() {
  return (
    <section
      className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-violet-100 bg-white/95 p-4 shadow-play"
      dir="ltr"
    >
      <h2 className="text-center text-lg font-bold text-slate-900">
        מסע בין שערים
      </h2>
      <p className="text-center text-sm font-medium text-slate-600">
        המשחק הקלאסי בגרסת יחיד. השתמשו במקלדת כדי לשחק.
      </p>
      <div
        className="relative mx-auto overflow-hidden rounded-3xl border border-slate-200 shadow-play"
        style={{ width: "862px", height: "640px" }}
      >
        <iframe
          title="ההרפתקה של אלג"
          src="/legacy/alges-escapade/index.htm"
          className="h-full w-full"
          style={{ border: 0 }}
        />
      </div>
    </section>
  );
}
