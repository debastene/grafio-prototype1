"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Button from "@/components/ui/Button";
import {
  Search, Filter, Plus, FolderOpen, Trash2, Pencil, Database,
  Sparkles, TrendingUp, Calendar, Heart, BarChart3, AlertTriangle,
  Loader2, ArrowRight, Grid3x3, LayoutList, X, Check,
} from "lucide-react";
import { listProjects, deleteProject, renameProject, ProjectListItem } from "@/lib/db/projects";
import { SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import { getSession, refreshSession, UserProfile } from "@/lib/auth/storage";

type SortKey = "newest" | "oldest" | "name" | "biggest";
type ViewMode = "grid" | "list";

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load session & projects
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      const fresh = await refreshSession();
      if (cancelled) return;
      setUser(fresh ?? getSession());
      if (!SUPABASE_CONFIGURED) {
        setError("Database belum di-setup. Lihat README untuk panduan Supabase setup.");
        setLoading(false);
        return;
      }
      try {
        const list = await listProjects();
        if (cancelled) return;
        setProjects(list);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal load projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let out = projects;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.file_name.toLowerCase().includes(q) ||
          p.domain_name.toLowerCase().includes(q),
      );
    }
    if (domainFilter) {
      out = out.filter((p) => p.domain_id === domainFilter);
    }
    if (sort === "newest") {
      out = [...out].sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sort === "oldest") {
      out = [...out].sort((a, b) => a.created_at.localeCompare(b.created_at));
    } else if (sort === "name") {
      out = [...out].sort((a, b) => a.name.localeCompare(b.name, "id"));
    } else if (sort === "biggest") {
      out = [...out].sort((a, b) => b.row_count - a.row_count);
    }
    return out;
  }, [projects, search, domainFilter, sort]);

  // Unique domains for filter pills
  const domains = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emoji: string; count: number }>();
    for (const p of projects) {
      const existing = map.get(p.domain_id);
      if (existing) existing.count++;
      else map.set(p.domain_id, { id: p.domain_id, name: p.domain_name, emoji: p.domain_emoji, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [projects]);

  // Stats banner
  const stats = useMemo(() => {
    const totalRows = projects.reduce((s, p) => s + (p.row_count ?? 0), 0);
    const totalCols = projects.reduce((s, p) => s + (p.column_count ?? 0), 0);
    const avgHealth = projects.length
      ? Math.round(
          projects.reduce((s, p) => s + (p.health_score ?? 0), 0) / projects.length,
        )
      : 0;
    const daysActive = user
      ? Math.max(1, Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000))
      : 0;
    return {
      totalProjects: projects.length,
      totalRows,
      totalCols,
      uniqueDomains: domains.length,
      avgHealth,
      daysActive,
    };
  }, [projects, domains, user]);

  const onDelete = async (id: string) => {
    if (!confirm("Hapus project ini? Tidak bisa dibatalkan.")) return;
    setDeleting(id);
    const res = await deleteProject(id);
    setDeleting(null);
    if (!res.ok) {
      alert(res.error ?? "Gagal hapus");
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const startRename = (p: ProjectListItem) => {
    setRenaming(p.id);
    setRenameValue(p.name);
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const id = renaming;
    const v = renameValue.trim();
    if (!v) {
      setRenaming(null);
      return;
    }
    const res = await renameProject(id, v);
    if (!res.ok) {
      alert(res.error ?? "Gagal rename");
      return;
    }
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: v } : p)));
    setRenaming(null);
  };

  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan mb-2">Project History</p>
            <h1 className="text-3xl md:text-4xl font-syne font-bold text-white">
              Workspace Kamu
            </h1>
            <p className="text-muted text-sm mt-1">
              {user
                ? `Halo ${user.name.split(" ")[0]}, ini semua project analisis kamu — search, filter, atau buka kembali.`
                : "Login untuk lihat project tersimpan"}
            </p>
          </div>
          <Link href="/dashboard">
            <Button>
              <Plus className="w-4 h-4" /> Analisis Baru
            </Button>
          </Link>
        </div>

        {/* STATS BANNER */}
        {!error && (
          <div className="relative glass rounded-3xl p-6 mb-8 overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-cyan/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-purple/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative grid grid-cols-2 md:grid-cols-5 gap-5">
              <StatTile
                icon={FolderOpen}
                value={stats.totalProjects}
                label="Project Tersimpan"
                color="cyan"
              />
              <StatTile
                icon={Database}
                value={formatBig(stats.totalRows)}
                label="Total Baris Dianalisis"
                color="purple"
              />
              <StatTile
                icon={Sparkles}
                value={stats.uniqueDomains}
                label="Domain Berbeda"
                color="mint"
              />
              <StatTile
                icon={Heart}
                value={stats.avgHealth || "—"}
                suffix={stats.avgHealth ? "/100" : ""}
                label="Avg Health Score"
                color="warning"
              />
              <StatTile
                icon={Calendar}
                value={stats.daysActive}
                suffix=" hari"
                label="Aktif di Grafio"
                color="violet"
              />
            </div>
          </div>
        )}

        {/* TOOLBAR */}
        {!error && projects.length > 0 && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari project, file, atau domain…"
                className="w-full pl-10 pr-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-cyan/50"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50 cursor-pointer"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="name">Nama (A-Z)</option>
              <option value="biggest">Dataset Terbesar</option>
            </select>

            <div className="flex bg-bgSurface border border-borderColor rounded-md p-1">
              <button
                onClick={() => setView("grid")}
                className={`px-2.5 py-1.5 rounded text-xs transition-all ${
                  view === "grid" ? "bg-cyan text-bgDeep" : "text-muted hover:text-white"
                }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-2.5 py-1.5 rounded text-xs transition-all ${
                  view === "list" ? "bg-cyan text-bgDeep" : "text-muted hover:text-white"
                }`}
                aria-label="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* DOMAIN FILTER PILLS */}
        {!error && domains.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted" />
            <button
              onClick={() => setDomainFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                !domainFilter
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-borderColor text-muted hover:border-cyan/40"
              }`}
            >
              Semua ({projects.length})
            </button>
            {domains.map((d) => (
              <button
                key={d.id}
                onClick={() => setDomainFilter(d.id === domainFilter ? null : d.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  domainFilter === d.id
                    ? "border-cyan bg-cyan/10 text-cyan"
                    : "border-borderColor text-muted hover:border-cyan/40"
                }`}
              >
                <span>{d.emoji}</span>
                <span>{d.name}</span>
                <span className="text-[10px] opacity-60">({d.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="glass rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
            <p className="text-white font-syne font-bold mb-2">Database belum siap</p>
            <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">{error}</p>
            <p className="text-xs text-muted mt-4">
              Cek <code className="text-cyan font-mono">README.md</code> untuk panduan setup Supabase
              (5 menit, gratis).
            </p>
          </div>
        )}

        {/* LOADING */}
        {!error && loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!error && !loading && projects.length === 0 && (
          <EmptyState />
        )}

        {/* NO MATCHES FOR SEARCH */}
        {!error && !loading && projects.length > 0 && filtered.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center">
            <Search className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-white font-syne font-bold mb-1">Tidak ada hasil</p>
            <p className="text-sm text-muted">
              Coba kata kunci lain atau hapus filter aktif.
            </p>
            {(search || domainFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDomainFilter(null);
                }}
                className="mt-4 text-xs text-cyan hover:underline"
              >
                Reset filter
              </button>
            )}
          </div>
        )}

        {/* PROJECTS GRID */}
        {!error && !loading && filtered.length > 0 && view === "grid" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={() => onDelete(p.id)}
                onRename={() => startRename(p)}
                deleting={deleting === p.id}
                renaming={renaming === p.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameConfirm={confirmRename}
                onRenameCancel={() => setRenaming(null)}
                onOpen={() => router.push(`/projects/${p.id}`)}
              />
            ))}
          </div>
        )}

        {/* PROJECTS LIST */}
        {!error && !loading && filtered.length > 0 && view === "list" && (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bgSurface text-left text-xs uppercase tracking-wider text-muted border-b border-borderColor">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4 text-right">Ukuran</th>
                  <th className="py-3 px-4 text-right">Health</th>
                  <th className="py-3 px-4 text-right">Dibuat</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-borderColor/40 hover:bg-bgElevated/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="text-left"
                      >
                        <p className="text-white font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted font-mono truncate max-w-[200px]">
                          {p.file_name}
                        </p>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs flex items-center gap-1.5">
                        <span>{p.domain_emoji}</span>
                        <span className="text-white">{p.domain_name}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-muted">
                      {p.row_count.toLocaleString("id")} × {p.column_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {p.health_score ? (
                        <span className={healthColor(p.health_score)}>
                          {p.health_score}/100
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-[11px] text-muted">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="text-cyan text-xs hover:underline flex items-center gap-1 ml-auto"
                      >
                        Buka <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatTile({
  icon: Icon, value, label, suffix, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  suffix?: string;
  color: "cyan" | "purple" | "mint" | "warning" | "violet";
}) {
  const cls: Record<string, string> = {
    cyan: "text-cyan bg-cyan/10 border-cyan/30",
    purple: "text-purple bg-purple/10 border-purple/30",
    mint: "text-mint bg-mint/10 border-mint/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    violet: "text-violetSoft bg-violet/10 border-violet/30",
  };
  return (
    <div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 border ${cls[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl md:text-3xl font-syne font-bold text-white leading-none">
        {value}
        {suffix && <span className="text-sm text-muted ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-muted mt-1">{label}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="h-8 bg-bgSurface rounded animate-pulse w-2/3" />
      <div className="h-3 bg-bgSurface rounded animate-pulse w-1/2" />
      <div className="h-20 bg-bgSurface rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-5 bg-bgSurface rounded animate-pulse w-16" />
        <div className="h-5 bg-bgSurface rounded animate-pulse w-16" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative glass rounded-3xl p-12 text-center overflow-hidden">
      <div className="absolute inset-0 bg-grad-mesh opacity-30 pointer-events-none" />
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan/20 to-purple/20 border border-cyan/30 flex items-center justify-center mx-auto mb-5">
          <FolderOpen className="w-10 h-10 text-cyan" />
        </div>
        <h2 className="text-2xl font-syne font-bold text-white mb-2">
          Belum ada project tersimpan
        </h2>
        <p className="text-muted max-w-md mx-auto mb-6 leading-relaxed text-sm">
          Setiap analisis yang kamu jalankan bisa di-save di sini. Mulai dengan upload file,
          jalankan analisis, lalu klik <span className="text-cyan font-semibold">Save Project</span>.
        </p>
        <Link href="/dashboard">
          <Button size="lg">
            <Plus className="w-4 h-4" /> Mulai Analisis Pertama
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ProjectCard({
  project, onDelete, onRename, deleting, renaming, renameValue, onRenameChange, onRenameConfirm, onRenameCancel, onOpen,
}: {
  project: ProjectListItem;
  onDelete: () => void;
  onRename: () => void;
  deleting: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="group relative glass rounded-2xl p-5 hover:border-cyan/40 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={() => !renaming && onOpen()}
    >
      {/* Glow tint based on health */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"
        style={{
          background:
            project.health_score && project.health_score >= 80
              ? "rgba(0, 255, 179, 0.25)"
              : project.health_score && project.health_score >= 60
                ? "rgba(0, 212, 255, 0.25)"
                : "rgba(123, 94, 167, 0.25)",
        }}
      />

      {/* Header: emoji + name + 3-dot menu */}
      <div className="relative flex items-start gap-3 mb-3">
        <div className="text-3xl flex-shrink-0">{project.domain_emoji}</div>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRenameConfirm();
                  if (e.key === "Escape") onRenameCancel();
                }}
                autoFocus
                className="flex-1 px-2 py-1 bg-bgSurface border border-cyan rounded text-sm text-white focus:outline-none"
              />
              <button
                onClick={onRenameConfirm}
                className="p-1 text-mint hover:bg-mint/10 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRenameCancel}
                className="p-1 text-muted hover:bg-bgElevated rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h3 className="font-syne font-bold text-white truncate group-hover:text-cyan transition-colors">
              {project.name}
            </h3>
          )}
          <p className="text-[10px] text-muted font-mono truncate" title={project.file_name}>
            {project.file_name}
          </p>
        </div>
        {!renaming && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-muted hover:text-white hover:bg-bgElevated rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Project menu"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-bgSurface border border-borderColor rounded-md shadow-soft p-1 z-10">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-white hover:bg-bgElevated"
                >
                  <Pencil className="w-3 h-3" /> Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  disabled={deleting}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-danger hover:bg-danger/10"
                >
                  {deleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {deleting ? "Menghapus…" : "Hapus"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sparkline thumbnail */}
      <div className="relative bg-bgSurface/40 rounded-lg p-3 mb-3 h-20 overflow-hidden">
        <SparkThumbnail data={normalizeThumb(project.thumbnail)} />
        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-widest text-muted bg-bgDeep/60 px-1.5 py-0.5 rounded">
          {project.domain_name}
        </span>
      </div>

      {/* Mini KPIs */}
      <div className="relative flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan/30 bg-cyan/5 text-cyan font-mono">
          <Database className="w-2.5 h-2.5 inline mr-1" />
          {formatBig(project.row_count)} baris
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple/30 bg-purple/5 text-purple font-mono">
          <BarChart3 className="w-2.5 h-2.5 inline mr-1" />
          {project.column_count} kolom
        </span>
        {project.health_score != null && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
              project.health_score >= 80
                ? "border-mint/30 bg-mint/5 text-mint"
                : project.health_score >= 60
                  ? "border-cyan/30 bg-cyan/5 text-cyan"
                  : "border-warning/30 bg-warning/5 text-warning"
            }`}
          >
            <Heart className="w-2.5 h-2.5 inline mr-1" />
            {project.health_score}/100
          </span>
        )}
      </div>

      {/* Summary */}
      {project.summary && (
        <p className="relative text-xs text-muted leading-relaxed line-clamp-2 mb-3">
          {project.summary}
        </p>
      )}

      {/* Footer */}
      <div className="relative flex items-center justify-between pt-3 border-t border-borderColor">
        <span className="text-[10px] text-muted flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(project.created_at)}
        </span>
        <span className="text-[10px] text-cyan group-hover:text-cyanSoft flex items-center gap-1">
          Buka <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
}

// Inline SVG sparkline
function SparkThumbnail({ data }: { data: number[] | null }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <TrendingUp className="w-6 h-6 text-muted opacity-30" />
      </div>
    );
  }
  const w = 100;
  const h = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke="#00D4FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("id");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const day = 86400000;
  if (diff < day) return "Hari ini";
  if (diff < 2 * day) return "Kemarin";
  if (diff < 7 * day) return Math.floor(diff / day) + " hari lalu";
  return date.toLocaleDateString("id", { day: "numeric", month: "short", year: "numeric" });
}

function healthColor(score: number): string {
  if (score >= 80) return "text-mint";
  if (score >= 60) return "text-cyan";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function normalizeThumb(t: unknown): number[] | null {
  if (!Array.isArray(t)) return null;
  const nums = t.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length >= 2 ? nums : null;
}
