import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  Search,
  Trash2,
  Lock,
  NotebookPen,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import * as api from "./api";
import type { Note } from "./domain";
export function Notes({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]),
    [active, setActive] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("Carregando…"),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [dirty, setDirty] = useState(false);
  const pending = useRef<Note | null>(null),
    busy = useRef(false),
    timer = useRef<number | undefined>(undefined);
  const selected = notes.find((n) => n.id === active);
  const load = () => {
    setError("");
    api
      .listNotes(userId)
      .then((data) => {
        setNotes(data);
        setActive(data[0]?.id || null);
        setStatus("Tudo salvo");
        setDirty(false);
        pending.current = null;
      })
      .catch((e) => {
        setError(e.message);
        setStatus("Falha ao carregar");
      });
  };
  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [userId]);
  async function flush() {
    if (busy.current || !pending.current) return;
    busy.current = true;
    const snapshot = pending.current;
    let savedSuccessfully = false;
    setStatus("Salvando…");
    try {
      const saved = await api.saveNote(snapshot);
      savedSuccessfully = true;
      if (pending.current === snapshot) {
        pending.current = null;
        setDirty(false);
        setNotes((all) => all.map((n) => (n.id === saved.id ? saved : n)));
        setStatus("Tudo salvo");
      } else if (pending.current && pending.current.id === saved.id) {
        pending.current = { ...pending.current, version: saved.version };
        setNotes((all) =>
          all.map((n) =>
            n.id === saved.id ? { ...n, version: saved.version } : n,
          ),
        );
        setStatus("Alterações pendentes");
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("Não foi possível salvar");
    } finally {
      busy.current = false;
      if (savedSuccessfully && pending.current && pending.current !== snapshot)
        timer.current = window.setTimeout(flush, 650);
    }
  }
  function edit(patch: Partial<Note>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setNotes((all) => all.map((n) => (n.id === next.id ? next : n)));
    pending.current = next;
    setDirty(true);
    setError("");
    setStatus("Alterações pendentes");
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 650);
  }
  async function add() {
    if (dirty) return;
    try {
      const n = await api.createNote(userId);
      setNotes((all) => [n, ...all]);
      setActive(n.id);
      setPreview(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (
      !selected ||
      !confirm(`Excluir “${selected.title}”? Esta ação não pode ser desfeita.`)
    )
      return;
    clearTimeout(timer.current);
    try {
      await api.deleteNote(selected.id, userId);
      pending.current = null;
      setDirty(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="notebook"
        role="dialog"
        aria-modal="true"
        aria-label="Notas privadas"
      >
        <header>
          <div className="note-heading">
            <NotebookPen size={30} />
            <div>
              <h2>Seu caderno de ideias</h2>
              <p>
                <Lock size={12} /> Só você pode ver estas notas
                {api.isDemo ? " · salvas neste navegador" : ""}
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar notas"
            onClick={() => {
              if (!dirty) onClose();
              else
                setError(
                  "Aguarde o salvamento ou recarregue para descartar as alterações.",
                );
            }}
          >
            <X />
          </button>
        </header>
        <div className="notes-body">
          <aside className="notes-list">
            <button className="gold full" onClick={add} disabled={dirty}>
              <Plus size={17} /> Nova nota
            </button>
            <label className="note-search">
              <Search size={16} />
              <input
                aria-label="Pesquisar notas"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nas notas…"
              />
            </label>
            {notes
              .filter((n) =>
                `${n.title} ${n.content} ${n.category}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.id}
                  disabled={dirty && active !== n.id}
                  className={`note-item ${active === n.id ? "selected" : ""}`}
                  onClick={() => setActive(n.id)}
                >
                  <small>{n.category}</small>
                  <strong>{n.title || "Sem título"}</strong>
                  <span>
                    {n.content.slice(0, 65) || "Uma página para começar…"}
                  </span>
                </button>
              ))}
            {!notes.length && (
              <p className="muted">Guarde aqui sua próxima grande ideia.</p>
            )}
          </aside>
          <main className="note-editor">
            {selected ? (
              <>
                <div className="editor-toolbar">
                  <select
                    aria-label="Categoria da nota"
                    value={selected.category}
                    onChange={(e) => edit({ category: e.target.value })}
                  >
                    {["Ideias", "Links", "Lembretes", "Projetos"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button onClick={() => setPreview(!preview)}>
                    {preview ? "Editar" : "Visualizar Markdown"}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Excluir nota"
                    onClick={remove}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <input
                  className="note-title"
                  aria-label="Título da nota"
                  value={selected.title}
                  maxLength={160}
                  onChange={(e) => edit({ title: e.target.value })}
                />
                {preview ? (
                  <article className="markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      skipHtml
                      urlTransform={(url) =>
                        /^https?:\/\//i.test(url) ? url : ""
                      }
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                            <ExternalLink size={12} />
                          </a>
                        ),
                      }}
                    >
                      {selected.content}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <textarea
                    aria-label="Conteúdo da nota"
                    value={selected.content}
                    maxLength={50000}
                    placeholder={
                      "Escreva uma ideia…\n\n# Markdown é bem-vindo\n- [ ] Sua próxima conquista\n[Um link](https://exemplo.com)"
                    }
                    onChange={(e) => edit({ content: e.target.value })}
                  />
                )}
                <div className="save-status">
                  <span>
                    <Check size={14} /> {status}
                  </span>
                  <button onClick={flush} disabled={!dirty}>
                    Salvar agora
                  </button>
                </div>
                <p className="markdown-hint">
                  Use # para títulos, - para listas e [texto](https://…) para
                  links. HTML não é executado.
                </p>
              </>
            ) : (
              <div className="empty-note">
                <NotebookPen size={45} />
                <h3>As boas ideias merecem um lugar.</h3>
                <p>Crie sua primeira nota para começar.</p>
              </div>
            )}
            {error && (
              <div className="error">
                {error}
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Recarregar e descartar alterações locais não salvas?",
                      )
                    )
                      load();
                  }}
                >
                  Recarregar notas
                </button>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
