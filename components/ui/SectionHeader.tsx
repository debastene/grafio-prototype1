type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionHeader({ eyebrow, title, description, align = "center" }: Props) {
  return (
    <div className={`mb-16 ${align === "center" ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <p className="inline-block text-[11px] font-mono uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-5">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-bold font-syne text-white mb-5 leading-[1.1]">
        {title.split(" ").map((w, i) =>
          /^(beautiful|insight|ai|data|grafio|cerdas|smart|beyond)$/i.test(w) ? (
            <span key={i} className="text-gradient">{w} </span>
          ) : (
            <span key={i}>{w} </span>
          ),
        )}
      </h2>
      {description && (
        <p className={`text-muted text-base md:text-lg max-w-2xl leading-relaxed ${align === "center" ? "mx-auto" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}
