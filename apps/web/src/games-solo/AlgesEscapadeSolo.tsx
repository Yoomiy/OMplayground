export function AlgesEscapadeSolo() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-3" dir="ltr">
      <h2 className="text-center text-lg font-semibold text-slate-100">
        מסע בין שערים
      </h2>
      <p className="text-center text-sm text-slate-300">
        המשחק הקלאסי בגרסת יחיד. השתמשו במקלדת כדי לשחק.
      </p>
      <div className="relative mx-auto" style={{ width: "862px", height: "640px" }}>
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
