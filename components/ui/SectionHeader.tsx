type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionHeader({ eyebrow, title, description, align = "center" }: Props) {
  return (
    <div className={`mb-12 ${align === "center" ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <p className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1 rounded-full mb-4">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-bold font-syne text-white mb-4">
        {title.split(" ").map((w, i) =>
          /^(beautiful|insight|ai|data|grafio|cerdas|smart|beyond)$/i.test(w) ? (
            <span key={i} className="text-gradient">{w} </span>
          ) : (
            <span key={i}>{w} </span>
          ),
        )}
      </h2>
      {description && (
        <p className={`text-muted max-w-2xl ${align === "center" ? "mx-auto" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}
