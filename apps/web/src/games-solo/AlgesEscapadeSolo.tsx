export function AlgesEscapadeSolo() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <h2 className="text-center text-lg font-semibold text-slate-100">
        ההרפתקה של אלג
      </h2>
      <p className="text-center text-sm text-slate-300">
        המשחק הקלאסי בגרסת יחיד. השתמשו במקלדת כדי לשחק.
      </p>
      <div className="relative w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <iframe
          title="ההרפתקה של אלג"
          src="/legacy/alges-escapade/index.htm"
          className="h-[680px] w-full"
        />
      </div>
    </section>
  );
}
