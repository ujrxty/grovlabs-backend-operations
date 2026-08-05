/**
 * Marks a block that has no real content behind it yet.
 *
 * Intentionally unattractive: a placeholder that survives to production
 * should be embarrassing, not decorative. Nothing here fills space with
 * invented copy, fake logos or made-up numbers.
 */
export default function Placeholder({
  title,
  needs,
  className = "",
}: {
  title: string;
  needs: string[];
  className?: string;
}) {
  return (
    <div className={`placeholder ${className}`}>
      <span className="placeholder-tag">Placeholder</span>
      <h3 className="h3 mt-3">{title}</h3>
      <p className="mt-1.5 text-[14px] text-muted">To fill this section, supply:</p>
      <ul className="mt-2 space-y-1">
        {needs.map((n) => (
          <li key={n} className="flex gap-2 text-[14px] text-body">
            <span aria-hidden="true" className="text-line-strong">
              —
            </span>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
