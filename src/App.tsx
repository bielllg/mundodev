import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Home,
  Compass,
  Map,
  NotebookPen,
  Search,
  Settings,
  Plus,
  Minus,
  LocateFixed,
  X,
  GitFork as Github,
  GitCommitHorizontal,
  Leaf,
  Star,
  ChevronRight,
  Share2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  VolumeX,
  Check,
  Trash2,
  Flag,
  Heart,
  Lock,
  Building2,
  MapPin,
} from "lucide-react";
import { City, type CityHandle, type EvolutionScene } from "./City";
import { Notes } from "./Notes";
import { buildingCanvas, COLORS } from "./art";
import {
  type Resident,
  type Profile,
  type Lot,
  type Repository,
  type DoorMessage,
  type Evolution,
  PRESETS,
  STAGES,
  NEIGHBORHOODS,
  levelForXp,
  stageForLevel,
  xpForLevel,
} from "./domain";
import * as api from "./api";
const SessionContext = createContext<Profile | null>(null);
function Art({
  language = "Outro",
  stage = 1,
  className = "",
}: {
  language?: string;
  stage?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c) {
      c.width = 320;
      c.height = 390;
      c.getContext("2d")!.drawImage(buildingCanvas(language, stage), 0, 0);
    }
  }, [language, stage]);
  return (
    <canvas
      aria-label={`${STAGES[stage - 1]} ${stage > 2 ? language : ""}`}
      ref={ref}
      className={`building-art ${className}`}
    />
  );
}
function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>
          Dev<span>City</span>
        </strong>
        <small>SEU CÓDIGO CONSTRÓI ESTA CIDADE</small>
      </div>
    </div>
  );
}
function Avatar({ profile }: { profile: Profile }) {
  return profile.avatar_url &&
    /^https:\/\/avatars\.githubusercontent\.com\//.test(profile.avatar_url) ? (
    <img
      className="avatar"
      src={profile.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="avatar pixel-avatar" aria-hidden="true">
      {profile.github_username.slice(0, 2).toUpperCase()}
    </div>
  );
}
function ProfilePanel({
  resident,
  onClose,
  notify,
  onRefresh,
}: {
  resident: Resident;
  onClose: () => void;
  notify: (s: string) => void;
  onRefresh: () => void;
}) {
  const me = useContext(SessionContext),
    own = me?.id === resident.id;
  const [repos, setRepos] = useState<Repository[]>([]),
    [messages, setMessages] = useState<DoorMessage[]>([]),
    [history, setHistory] = useState<Evolution[]>([]),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const level = levelForXp(resident.current_xp),
    stage = stageForLevel(level),
    progress =
      ((resident.current_xp - xpForLevel(level)) /
        (xpForLevel(level + 1) - xpForLevel(level))) *
      100;
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.repositories(resident.id),
      api.listMessages(resident.building_id, page),
      own ? api.evolutions() : Promise.resolve([]),
    ])
      .then(([r, m, h]) => {
        setRepos(r);
        setMessages(m);
        setHistory(h);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resident.id, resident.building_id, page, own]);
  useEffect(reload, [reload]);
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      notify(success);
      reload();
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside
      className="side-panel profile-panel"
      aria-label={`Prédio de ${resident.github_username}`}
    >
      <div className="panel-topline">
        <span>{own ? "MEU CANTINHO NA CIDADE" : "VOCÊ ESTÁ VISITANDO"}</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar perfil"
        >
          <X size={20} />
        </button>
      </div>
      <div className="profile-heading">
        <Avatar profile={resident} />
        <div>
          <h2>{resident.github_username}</h2>
          <p>
            <span className="online-dot" />
            {resident.primary_language}{" "}
            <span className="level-pill">Nível {level}</span>
          </p>
        </div>
      </div>
      <p className="bio">
        {resident.bio || "Uma nova história está começando na DevCity."}
      </p>
      <div
        className="profile-illustration"
        style={{ backgroundColor: COLORS[resident.primary_language] + "22" }}
      >
        <Art language={resident.primary_language} stage={stage} />
        <div className="stage-label">
          <Building2 size={16} />
          {STAGES[stage - 1]}
        </div>
      </div>
      <div className="xp-line">
        <strong>{resident.current_xp.toLocaleString("pt-BR")} XP</strong>
        <span>
          Nível {level + 1} · {xpForLevel(level + 1).toLocaleString("pt-BR")} XP
        </span>
      </div>
      <p className="fine-print commit-stat">
        <GitCommitHorizontal size={15} />{" "}
        {Math.floor(resident.current_xp / 10).toLocaleString("pt-BR")} commits
        recompensados · limite diário aplicado
      </p>
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="fine-print">
        Somente commits públicos elegíveis geram XP. Até 100 XP por dia, a
        partir do primeiro dia UTC completo após o cadastro.
      </p>
      <div className="profile-actions">
        <a
          className="secondary"
          href={`https://github.com/${encodeURIComponent(resident.github_username)}`}
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} /> GitHub <ArrowUpRight size={14} />
        </a>
        <button
          className="secondary"
          onClick={() =>
            navigator.clipboard
              .writeText(`${location.origin}/cidade?predio=${resident.id}`)
              .then(() => notify("Link do prédio copiado!"))
              .catch(() => notify("Não foi possível copiar o link."))
          }
        >
          <Share2 size={16} /> Compartilhar
        </button>
      </div>
      {own && (
        <button
          disabled={busy || api.isDemo}
          className="sync-button"
          onClick={() => action(api.syncGitHub, "GitHub sincronizado.")}
        >
          <RefreshCw size={15} /> Atualizar GitHub{" "}
          <small>1 vez a cada 24h</small>
        </button>
      )}
      <p className="sync-date">
        Última sincronização:{" "}
        {resident.last_synced_at
          ? new Date(resident.last_synced_at).toLocaleString("pt-BR")
          : api.isDemo
            ? "dados fictícios"
            : "aguardando sincronização"}
      </p>
      <h3 className="section-title">
        <Github size={17} /> Projetos em destaque
      </h3>
      {loading ? (
        <p className="muted">Carregando projetos e mural…</p>
      ) : repos.length ? (
        repos.map((r) => (
          <a
            key={r.name}
            className="repo"
            target="_blank"
            rel="noopener noreferrer"
            href={
              /^https:\/\/github\.com(?:\/|$)/.test(r.url)
                ? r.url
                : "https://github.com"
            }
          >
            <span className="repo-icon">⌘</span>
            <div>
              <strong>{r.name}</strong>
              <p>{r.description || "Um projeto esperando sua visita."}</p>
              <small>
                <i
                  style={{ backgroundColor: COLORS[r.language] || "#a8cfa5" }}
                />
                {r.language || "Código"} <Star size={11} /> {r.stars}
              </small>
            </div>
            <ArrowUpRight size={16} />
          </a>
        ))
      ) : (
        <p className="muted">Nenhum repositório sincronizado ainda.</p>
      )}
      <h3 className="section-title">
        <Heart size={17} /> Mural da porta
      </h3>
      <p className="muted">Pequenos recados, grandes sorrisos.</p>
      {resident.wall_enabled ? (
        <>
          <div className="preset-grid">
            {PRESETS.map((p, i) => (
              <button
                key={p}
                disabled={!me || busy || own}
                onClick={() =>
                  action(
                    () => api.sendMessage(resident.building_id, i, me!.id),
                    "Seu recado ficou na porta!",
                  )
                }
              >
                {p}
              </button>
            ))}
          </div>
          {!me && (
            <p className="fine-print">
              Entre com GitHub para deixar um recado.
            </p>
          )}
          {messages.map((m) => (
            <div className="door-message" key={m.id}>
              <span>{PRESETS[m.preset_message_id]}</span>
              {own && (
                <>
                  <button
                    aria-label="Excluir recado"
                    onClick={() =>
                      action(() => api.removeMessage(m.id), "Recado removido.")
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    aria-label="Bloquear remetente"
                    onClick={() =>
                      action(
                        () => api.blockUser(m.sender_id, me.id),
                        "Usuário bloqueado no seu mural.",
                      )
                    }
                  >
                    <Flag size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>{page + 1}</span>
            <button
              disabled={messages.length < 10}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      ) : (
        <p className="muted">O morador desativou o mural.</p>
      )}
      {own && (
        <button
          className="text-button"
          onClick={() =>
            action(
              () => api.toggleWall(!resident.wall_enabled),
              resident.wall_enabled ? "Mural desativado." : "Mural ativado.",
            )
          }
        >
          {resident.wall_enabled ? "Desativar" : "Ativar"} meu mural
        </button>
      )}
      {own && history.length > 0 && (
        <>
          <h3 className="section-title">Histórico de evoluções</h3>
          {history.map((h) => (
            <p className="fine-print" key={h.id}>
              {STAGES[h.previous_stage - 1]} → {STAGES[h.new_stage - 1]} ·{" "}
              {new Date(h.created_at).toLocaleDateString("pt-BR")}
            </p>
          ))}
        </>
      )}
      {error && (
        <div className="error">
          {error}
          <button onClick={reload}>Tentar novamente</button>
        </div>
      )}
    </aside>
  );
}
export default function App() {
  const locationHook = useLocation(),
    navigate = useNavigate(),
    city = useRef<CityHandle>(null);
  const [me, setMe] = useState<Profile | null>(null),
    [demoUser, setDemoUser] = useState(
      sessionStorage.getItem("devcity-demo-user") === "yes",
    ),
    [residents, setResidents] = useState<Resident[]>([]),
    [lots, setLots] = useState<Lot[]>([]),
    [region, setRegion] = useState<api.Region>({
      minX: -1,
      maxX: 2,
      minY: -1,
      maxY: 2,
    }),
    [selected, setSelected] = useState<Resident | null>(null),
    [selectedLot, setSelectedLot] = useState<Lot | null>(null),
    [panel, setPanel] = useState<"map" | "search" | "settings" | null>(null),
    [notes, setNotes] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Resident[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [low, setLow] = useState(localStorage.getItem("devcity-low") === "yes"),
    [evolution, setEvolution] = useState<EvolutionScene | undefined>(),
    [introDismissed, setIntroDismissed] = useState(false);
  const [neighborhood, setNeighborhood] = useState("Praça dos Commits");
  const landing =
    locationHook.pathname === "/" && !locationHook.search.includes("predio");
  const isMounted = useRef(true),
    loadSeq = useRef(0);
  const notify = useCallback((s: string) => {
    setMessage(s);
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);
  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const data = await api.loadRegion(region);
      if (seq === loadSeq.current) {
        setResidents(data.residents);
        setLots(data.lots);
        setMe((previous) =>
          previous
            ? data.residents.find((r) => r.id === previous.id) || previous
            : null,
        );
        setError("");
        setSelected((previous) =>
          previous
            ? data.residents.find((r) => r.id === previous.id) || previous
            : null,
        );
      }
    } catch (e) {
      if (seq === loadSeq.current) setError((e as Error).message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [region]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (api.isDemo) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        api.invalidateRegionCache();
        void refresh();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    isMounted.current = true;
    if (!api.supabase) {
      setMe(demoUser ? api.demoProfile() : null);
      return;
    }
    const load = async (session: api.Session | null) => {
      try {
        setMe(session ? await api.getProfile(session.user.id) : null);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    api.supabase.auth.getSession().then(({ data }) => load(data.session));
    const {
      data: { subscription },
    } = api.supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (isMounted.current) void load(session);
      }, 0);
    });
    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [demoUser]);
  useEffect(() => {
    if (!me || api.isDemo) return;
    api
      .evolutions()
      .then(async (events) => {
        const unseen = events.filter((e) => !e.viewed_at);
        if (!unseen.length) return;
        const r = await api.residentById(me.id);
        if (r) {
          setEvolution({
            lot: r.lot,
            previousStage: unseen[unseen.length - 1].previous_stage,
            newStage: unseen[0].new_stage,
            eventIds: unseen.map((e) => e.id),
          });
          notify(`Seu prédio evoluiu para ${STAGES[unseen[0].new_stage - 1]}!`);
        }
      })
      .catch((e) => setError(e.message));
  }, [me?.id, me?.current_xp, notify]);
  const visit = useCallback(
    (r: Resident) => {
      setSelected(r);
      setPanel(null);
      setSelectedLot(null);
      city.current?.go(r.lot.tile_x, r.lot.tile_y);
      navigate(`/cidade?predio=${encodeURIComponent(r.id)}`, { replace: true });
    },
    [navigate],
  );
  useEffect(() => {
    const id = new URLSearchParams(locationHook.search).get("predio");
    if (id && selected?.id !== id)
      api
        .residentById(id)
        .then((r) => {
          if (r) {
            setSelected(r);
            city.current?.go(r.lot.tile_x, r.lot.tile_y);
          } else notify("Este prédio não foi encontrado.");
        })
        .catch((e) => setError(e.message));
  }, [locationHook.search]);
  useEffect(() => {
    if (panel !== "search") return;
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .findResidents(query)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch((e) => setError(e.message));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, panel]);
  const own = async () => {
    if (!me) {
      notify(
        "Entre com GitHub ou use a demonstração para conhecer seu prédio.",
      );
      return;
    }
    try {
      const r = await api.residentById(me.id);
      if (r) visit(r);
      else {
        setPanel("map");
        notify("Escolha um terreno livre para começar sua história.");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  async function authenticate() {
    try {
      await api.login();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function enterDemo() {
    sessionStorage.setItem("devcity-demo-user", "yes");
    setDemoUser(true);
    navigate("/cidade");
    setIntroDismissed(true);
  }
  const selectLot = (lot: Lot) => {
    setSelected(null);
    setPanel(null);
    setSelectedLot(lot);
    city.current?.go(lot.tile_x, lot.tile_y);
  };
  const togglePanel = (p: typeof panel) => {
    setPanel(panel === p ? null : p);
    setSelected(null);
    setSelectedLot(null);
  };
  return (
    <SessionContext.Provider value={me}>
      <div className={`app ${landing ? "is-landing" : ""}`}>
        <City
          ref={city}
          residents={residents}
          lots={lots}
          onSelect={(id) => {
            const r = residents.find((r) => r.id === id);
            if (r) visit(r);
          }}
          onLot={selectLot}
          onRegion={setRegion}
          onNeighborhood={setNeighborhood}
          low={low}
          evolution={evolution}
          onEvolutionDone={(ids) => {
            Promise.all(ids.map(api.markEvolution))
              .then(() => setEvolution(undefined))
              .catch((e) => setError(e.message));
          }}
        />
        <div className="sky-haze" />
        <header className="topbar">
          <button
            className="logo-button"
            aria-label="Página inicial DevCity"
            onClick={() => navigate("/")}
          >
            <Logo />
          </button>
          {!landing && (
            <nav className="main-nav" aria-label="Navegação principal">
              <button
                className={selected?.id === me?.id && me ? "active" : ""}
                onClick={own}
              >
                <Home size={19} />
                <span>Meu prédio</span>
              </button>
              <button
                className={!panel && !selected ? "active" : ""}
                onClick={() => {
                  setPanel(null);
                  setSelected(null);
                  setSelectedLot(null);
                  navigate("/cidade", { replace: true });
                }}
              >
                <Compass size={19} />
                <span>Explorar</span>
              </button>
              <button
                className={panel === "map" ? "active" : ""}
                onClick={() => togglePanel("map")}
              >
                <Map size={19} />
                <span>Mapa</span>
              </button>
              {me && (
                <button onClick={() => setNotes(true)}>
                  <NotebookPen size={19} />
                  <span>Notas</span>
                </button>
              )}
            </nav>
          )}
          <div className="header-right">
            {!landing && (
              <button
                className="search-trigger icon-button"
                aria-label="Buscar desenvolvedores"
                onClick={() => togglePanel("search")}
              >
                <Search size={20} />
              </button>
            )}
            {me ? (
              <button className="user-chip" onClick={own}>
                <Avatar profile={me} />
                <div>
                  <strong>{me.github_username}</strong>
                  <span>
                    Nível {levelForXp(me.current_xp)} <i />
                  </span>
                </div>
              </button>
            ) : (
              !landing && (
                <button className="login-small" onClick={authenticate}>
                  <Github size={17} /> Entrar
                </button>
              )
            )}
            <button
              className={`settings-button icon-button ${panel === "settings" ? "active" : ""}`}
              onClick={() => togglePanel("settings")}
              aria-label="Configurações"
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        {landing ? (
          <div className="landing-content">
            <div className="eyebrow">
              <span className="online-dot" /> UM LUGAR PARA QUEM CONSTRÓI
            </div>
            <h1>
              Seu código.
              <br />
              Sua história.
              <br />
              <em>Sua cidade.</em>
            </h1>
            <p>
              Uma cidade feita de pessoas e boas ideias.
              <br />
              Conecte seu GitHub, contribua e veja seu
              <br className="desktop-break" /> cantinho crescer com você.
            </p>
            <div className="landing-buttons">
              <button className="gold" onClick={authenticate}>
                <Github size={21} /> Entrar com GitHub <ArrowRight size={20} />
              </button>
              <button
                className="visitor-button"
                onClick={() => navigate("/cidade")}
              >
                <Compass size={19} /> Explorar como visitante{" "}
                <ArrowUpRight size={18} />
              </button>
            </div>
            {api.isDemo && (
              <button className="demo-link" onClick={enterDemo}>
                Conhecer a demonstração completa <ArrowRight size={14} />
              </button>
            )}
            <div className="landing-trust">
              <span>
                <Leaf size={14} /> Cada contribuição conta
              </span>
              <span>
                <Heart size={14} /> Feito para construir junto
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="location-badge">
              <span className="online-dot" />
              <div>
                <small>VOCÊ ESTÁ NA</small>
                <strong>{neighborhood}</strong>
              </div>
              <ChevronRight size={17} />
            </div>
            {!selected && !panel && !selectedLot && (
              <div className="world-label">
                <span>✦</span> Um commit de cada vez.
                <small>É assim que a cidade cresce.</small>
              </div>
            )}
            <button
              className="floating-search"
              onClick={() => togglePanel("search")}
            >
              <Search size={17} />
              <span>Encontre seu próximo vizinho</span>
              <kbd>⌕</kbd>
            </button>
          </>
        )}
        {landing && (
          <div className="landing-evolution">
            <span className="little-star">✦</span>
            <div>
              <strong>Toda grande história começa pequena.</strong>
              <p>Seus commits viram progresso. Seu prédio evolui.</p>
            </div>
            <div className="tiny-houses">
              <Art stage={1} />
              <ArrowRight size={15} />
              <Art language="Python" stage={3} />
              <ArrowRight size={15} />
              <Art language="JavaScript" stage={5} />
            </div>
          </div>
        )}
        {!landing && (
          <div className="map-controls">
            <button
              aria-label="Ampliar mapa"
              onClick={() => city.current?.zoom(1.2)}
            >
              <Plus size={20} />
            </button>
            <button
              aria-label="Reduzir mapa"
              onClick={() => city.current?.zoom(1 / 1.2)}
            >
              <Minus size={20} />
            </button>
            <div />
            <button
              aria-label="Centralizar cidade"
              onClick={() => city.current?.go(6, 6)}
            >
              <LocateFixed size={20} />
            </button>
          </div>
        )}
        {!landing && !introDismissed && !selected && !panel && !selectedLot && (
          <div className="welcome-card">
            <button
              className="welcome-close"
              onClick={() => setIntroDismissed(true)}
              aria-label="Dispensar boas-vindas"
            >
              <X size={14} />
            </button>
            <div className="welcome-icon">🌱</div>
            <div>
              <strong>Uma cidade. Milhares de histórias.</strong>
              <p>
                Cada prédio é uma pessoa. Cada commit,
                <br />
                um novo pedacinho dessa história.
              </p>
              <button
                onClick={() => {
                  setPanel("map");
                  setIntroDismissed(true);
                }}
              >
                Encontre seu lugar <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
        {!landing && selected && (
          <ProfilePanel
            key={selected.id}
            resident={selected}
            onClose={() => {
              setSelected(null);
              navigate("/cidade", { replace: true });
            }}
            notify={notify}
            onRefresh={refresh}
          />
        )}
        {panel === "map" && (
          <aside className="side-panel">
            <div className="panel-topline">
              <span>EXPLORE A DEVCITY</span>
              <button
                className="icon-button"
                onClick={() => setPanel(null)}
                aria-label="Fechar mapa"
              >
                <X size={20} />
              </button>
            </div>
            <h2>Um bairro para cada história.</h2>
            <p className="muted">Escolha um destino e conheça a vizinhança.</p>
            <div className="neighborhoods">
              {NEIGHBORHOODS.map((n, i) => (
                <button
                  key={n.name}
                  onClick={() => {
                    city.current?.go(n.x, n.y);
                    setPanel(null);
                  }}
                >
                  <span className={`neighborhood-art art-${i}`}>{n.icon}</span>
                  <div>
                    <strong>{n.name}</strong>
                    <p>{n.description}</p>
                  </div>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
            <div className="info-box">
              <Leaf size={20} />
              <p>
                Seu primeiro terreno é o começo de tudo. Clique em um{" "}
                <strong>lote com +</strong> no mapa para conhecer o local.
              </p>
            </div>
            <button
              className="secondary full"
              onClick={() => togglePanel("search")}
            >
              <Search size={17} /> Encontrar desenvolvedores
            </button>
          </aside>
        )}
        {panel === "search" && (
          <aside className="side-panel">
            <div className="panel-topline">
              <span>BOAS CONEXÕES COMEÇAM AQUI</span>
              <button
                className="icon-button"
                onClick={() => setPanel(null)}
                aria-label="Fechar busca"
              >
                <X size={20} />
              </button>
            </div>
            <h2>Conheça seus vizinhos.</h2>
            <label className="search-field">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Usuário do GitHub…"
                aria-label="Buscar usuário GitHub"
                value={query}
                maxLength={39}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <p className="fine-print">
              {api.isDemo
                ? "Moradores fictícios da demonstração"
                : "Desenvolvedores com prédio na cidade"}
            </p>
            {results.map((r) => (
              <button
                className="resident-result"
                key={r.id}
                onClick={() => visit(r)}
              >
                <Avatar profile={r} />
                <div>
                  <strong>{r.github_username}</strong>
                  <p>
                    {r.primary_language} · Nível {levelForXp(r.current_xp)}
                  </p>
                </div>
                <ArrowUpRight size={17} />
              </button>
            ))}
            {!results.length && (
              <p className="muted">
                Nenhum morador encontrado. Tente outro nome.
              </p>
            )}
          </aside>
        )}
        {selectedLot && (
          <aside className="side-panel lot-panel">
            <div className="panel-topline">
              <span>UM NOVO COMEÇO</span>
              <button
                className="icon-button"
                onClick={() => setSelectedLot(null)}
                aria-label="Fechar terreno"
              >
                <X size={20} />
              </button>
            </div>
            <h2>Seu lugar na cidade.</h2>
            <p className="muted">Pequeno no começo. Cheio de possibilidades.</p>
            <div className="lot-preview">
              <Art stage={1} />
            </div>
            <div className="lot-detail">
              <MapPin size={17} /> Terreno {selectedLot.tile_x},{" "}
              {selectedLot.tile_y}
              <span>Disponível</span>
            </div>
            <p className="bio">
              Todo mundo começa com a mesma casinha. Seus commits fazem o resto:
              cada contribuição ajuda seu prédio a crescer.
            </p>
            <div className="info-box">
              <Lock size={18} />
              <p>
                O terreno é permanente. Sua conta pode ter apenas um prédio.
              </p>
            </div>
            <button
              className="gold full"
              disabled={busy}
              onClick={async () => {
                if (!me) {
                  notify("Entre com GitHub para conquistar seu terreno.");
                  return;
                }
                setBusy(true);
                try {
                  await api.claimLot(selectedLot.id, me.id);
                  await refresh();
                  setSelectedLot(null);
                  notify("Bem-vindo ao seu novo cantinho!");
                  await own();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Home size={19} />
              {busy ? "Reservando…" : "Escolher este terreno"}
              <ArrowRight size={18} />
            </button>
          </aside>
        )}
        {panel === "settings" && (
          <aside className="side-panel">
            <div className="panel-topline">
              <span>DO SEU JEITO</span>
              <button
                className="icon-button"
                onClick={() => setPanel(null)}
                aria-label="Fechar configurações"
              >
                <X size={20} />
              </button>
            </div>
            <h2>Uma pausa para ajustar.</h2>
            <div className="setting-row">
              <div>
                <strong>Modo leve</strong>
                <p>Reduz a densidade de vegetação.</p>
              </div>
              <input
                type="checkbox"
                aria-label="Modo leve"
                checked={low}
                onChange={(e) => {
                  setLow(e.target.checked);
                  localStorage.setItem(
                    "devcity-low",
                    e.target.checked ? "yes" : "no",
                  );
                }}
              />
            </div>
            <div className="setting-row">
              <VolumeX size={20} />
              <p>A cidade não reproduz áudio.</p>
            </div>
            <div className="info-box">
              <ShieldCheck size={23} />
              <p>
                O progresso é calculado no servidor. Suas notas são privadas e
                seus tokens nunca são públicos.
              </p>
            </div>
            {api.isDemo && (
              <div className="demo-box">
                <strong>Você está em uma demonstração.</strong>
                <p>
                  Moradores e projetos são fictícios. As notas ficam apenas
                  neste navegador. Não consultamos o GitHub.
                </p>
                {!me && (
                  <button className="gold full" onClick={enterDemo}>
                    Experimentar como devluna <ArrowRight size={17} />
                  </button>
                )}
              </div>
            )}
            {me && (
              <>
                <button
                  className="secondary full"
                  onClick={async () => {
                    await api.logout();
                    sessionStorage.removeItem("devcity-demo-user");
                    setDemoUser(false);
                    setMe(null);
                    setSelected(null);
                    setNotes(false);
                    setPanel(null);
                    notify("Você saiu da sua conta.");
                  }}
                >
                  <LogOut size={17} /> Sair da conta
                </button>
                <button
                  className="danger-link"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Excluir permanentemente sua conta, terreno e notas? Esta ação não pode ser desfeita.",
                      )
                    )
                      return;
                    try {
                      await api.deleteAccount();
                      await api.logout();
                      sessionStorage.removeItem("devcity-demo-user");
                      setDemoUser(false);
                      setMe(null);
                      setPanel(null);
                      await refresh();
                      notify("Conta e dados excluídos.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {api.isDemo
                    ? "Redefinir demonstração"
                    : "Excluir minha conta e meus dados"}
                </button>
              </>
            )}
          </aside>
        )}
        {notes && me && (
          <Notes userId={me.id} onClose={() => setNotes(false)} />
        )}
        <footer className="world-footer">
          <span>
            <i /> {api.isDemo ? "MODO DEMONSTRAÇÃO" : "CIDADE COMPARTILHADA"}
          </span>
          {api.isDemo && !landing && !me && (
            <button onClick={enterDemo}>
              Experimentar com devluna <ArrowRight size={13} />
            </button>
          )}
          <span className="navigation-hint">
            {loading ? "Carregando vizinhança…" : "Arraste para explorar"}{" "}
            <b>·</b> Role para aproximar
          </span>
        </footer>
        {message && (
          <div className="toast" role="status">
            <Check size={17} />
            {message}
            <button onClick={() => setMessage("")} aria-label="Fechar aviso">
              <X size={15} />
            </button>
          </div>
        )}
        {error && (
          <div className="toast error-toast" role="alert">
            {error}
            <button
              onClick={() => {
                setError("");
                refresh();
              }}
            >
              Tentar novamente
            </button>
            <button aria-label="Fechar erro" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </SessionContext.Provider>
  );
}
