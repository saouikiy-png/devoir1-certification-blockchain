import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Abi, getAddress, isAddress, parseAbiItem, parseEventLogs } from "viem";
import * as XLSX from "xlsx";
import registryArtifact from "./contracts/CertificateRegistry.json";
import { hardhat } from "./wagmi";

type CertificateRow = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: string;
  grade: string;
  errors: string[];
};

type CertificateView = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  grade: string;
  recipient: string;
  revoked: boolean;
};
const abi = registryArtifact.abi as Abi;
const contractAddress = registryArtifact.address as `0x${string}`;
const requiredColumns = ["studentName", "studentId", "diplomaTitle", "issueDate", "recipientAddress", "grade"];

function normalizeCertificate(value: unknown): CertificateView {
  const fields: Record<string, unknown> = Array.isArray(value)
    ? {
        studentName: value[0],
        studentId: value[1],
        diplomaTitle: value[2],
        issueDate: value[3],
        grade: value[4],
        recipient: value[5],
        revoked: value[6]
      }
    : value !== null && typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  const { studentName, studentId, diplomaTitle, issueDate, grade, recipient, revoked } = fields;
  if (
    typeof studentName !== "string" ||
    typeof studentId !== "string" ||
    typeof diplomaTitle !== "string" ||
    typeof issueDate !== "string" ||
    typeof grade !== "string" ||
    typeof recipient !== "string" ||
    typeof revoked !== "boolean"
  ) {
    throw new Error("Réponse getCertificate invalide : format de certificat inattendu.");
  }

  return { studentName, studentId, diplomaTitle, issueDate, grade, recipient, revoked };
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function App() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">CertiChain<span>Académique</span></Link>
        <nav><Link className={location.pathname === "/" ? "active" : ""} to="/">Vérifier</Link><Link className={location.pathname === "/admin" ? "active" : ""} to="/admin">Administration</Link></nav>
      </header>
      <main>
        <Routes><Route path="/" element={<VerifyPage />} /><Route path="/verify" element={<VerifyPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
      </main>
      <footer>Certification académique vérifiable sur le réseau local Hardhat</footer>
    </div>
  );
}

function NetworkBanner() {
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!chainId || chainId === hardhat.id) return null;
  return <div className="alert warning">Réseau incorrect (chain ID {chainId}). Connectez MetaMask à Hardhat Local (31337). <button className="button small" onClick={() => switchChain({ chainId: hardhat.id })} disabled={isPending}>Changer de réseau</button></div>;
}

function WalletPanel() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  return <section className="wallet-panel">
    <div><span className={`status-dot ${isConnected ? "online" : ""}`} />{isConnected ? <><b>Wallet connecté</b><span className="muted">{address}</span><span className="muted">{chain?.name ?? `Chain ${chain?.id}`}</span></> : <><b>Wallet non connecté</b><span className="muted">Utilisez MetaMask sur Hardhat local.</span></>}</div>
    {isConnected ? <button className="button secondary" onClick={() => disconnect()}>Déconnexion</button> : <button className="button" disabled={isPending || !connectors[0]} onClick={() => connectors[0] && connect({ connector: connectors[0] })}>{isPending ? "Connexion..." : "Connecter MetaMask"}</button>}
    {error && <p className="error-text">{error.message}</p>}
  </section>;
}

function VerifyPage() {
  const [input, setInput] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const [certificate, setCertificate] = useState<CertificateView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "missing" | "error">("idle");
  const [message, setMessage] = useState("");
  const publicClient = usePublicClient({ chainId: hardhat.id });
  const addressReady = isAddress(contractAddress);

  async function search(event: FormEvent) {
    event.preventDefault();
    const id = input.trim();
    if (!/^[1-9]\d*$/.test(id)) {
      setMessage("Saisissez un identifiant numérique supérieur à zéro.");
      setStatus("error");
      setCertificate(null);
      return;
    }
    if (!addressReady || !publicClient) {
      setMessage("Contrat non configuré ou nœud Hardhat inaccessible. Déployez le contrat et vérifiez le nœud local.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setMessage("");
    setCertificate(null);
    try {
      const result = await publicClient.readContract({ address: contractAddress, abi, functionName: "getCertificate", args: [BigInt(id)] });
      setCertificate(normalizeCertificate(result));
      setCertificateId(id);
      setStatus("found");
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes("CertificateNotFound")) {
        setStatus("missing");
      } else {
        setMessage(text.startsWith("Réponse getCertificate")
          ? text
          : "Impossible de joindre le contrat sur le réseau local. Vérifiez que le nœud Hardhat fonctionne.");
        setStatus("error");
      }
    }
  }

  return <section className="page">
    <div className="hero"><span className="eyebrow">REGISTRE ACADÉMIQUE</span><h1>Vérifiez un certificat.</h1><p>Consultez un diplôme certifié et son statut, directement depuis la blockchain.</p></div>
    <div className="card verify-card">
      <form className="search-form" onSubmit={search}><label htmlFor="certId">Identifiant du certificat</label><div className="search-row"><input id="certId" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex. 1" inputMode="numeric" /><button className="button" disabled={status === "loading"}>{status === "loading" ? "Recherche..." : "Vérifier"}</button></div></form>
      {!addressReady && <p className="alert warning">Adresse du contrat absente. Lancez le déploiement local pour la générer.</p>}
      {status === "error" && <p className="alert danger">{message}</p>}
      {status === "missing" && <p className="alert warning">Aucun certificat trouvé pour l’identifiant {input}.</p>}
      {certificate && <article className="certificate-result">
        <div className="result-heading"><div><span className="eyebrow">CERTIFICAT #{certificateId}</span><h2>{certificate.studentName}</h2></div><span className={`badge ${certificate.revoked ? "revoked" : "valid"}`}>{certificate.revoked ? "Révoqué" : "Valide"}</span></div>
        <dl className="details-grid"><Detail label="Identifiant étudiant" value={certificate.studentId} /><Detail label="Diplôme" value={certificate.diplomaTitle} /><Detail label="Date d’émission" value={certificate.issueDate} /><Detail label="Mention" value={certificate.grade || "—"} /><Detail label="Destinataire" value={certificate.recipient} /></dl>
      </article>}
    </div>
    <div className="contract-note">Lecture publique · Sans connexion wallet · Chain ID 31337</div>
  </section>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail"><dt>{label}</dt><dd>{value}</dd></div>;
}

function AdminPage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: hardhat.id });
  const { writeContractAsync } = useWriteContract();
  const [admin, setAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ studentName: "", studentId: "", diplomaTitle: "", issueDate: "", recipientAddress: "", grade: "" });
  const [fileRows, setFileRows] = useState<CertificateRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [mode, setMode] = useState<"batch" | "single">("batch");
  const [batchSize, setBatchSize] = useState(10);
  const [transactions, setTransactions] = useState<{ hash: string; state: string; certIds?: string[] }[]>([]);
  const ready = Boolean(isConnected && chainId === hardhat.id && admin && publicClient && isAddress(contractAddress));

  useEffect(() => {
    let active = true;
    async function check() {
      setAdmin(false);
      if (!address || chainId !== hardhat.id || !publicClient || !isAddress(contractAddress)) return;
      setCheckingAdmin(true);
      try {
        const result = await publicClient.readContract({ address: contractAddress, abi, functionName: "isAdmin", args: [address] });
        if (active) setAdmin(Boolean(result));
      } catch {
        if (active) setError("Impossible de vérifier les droits administrateur. Vérifiez le déploiement et le nœud local.");
      } finally {
        if (active) setCheckingAdmin(false);
      }
    }
    void check();
    return () => { active = false; };
  }, [address, chainId, publicClient]);

  function updateForm(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function validateRow(row: Omit<CertificateRow, "errors">): string[] {
    const errors: string[] = [];
    for (const key of ["studentName", "studentId", "diplomaTitle", "issueDate"] as const) {
      if (!row[key].trim()) errors.push(`${key}: champ obligatoire`);
    }
    if (row.issueDate && !isIsoDate(row.issueDate)) errors.push("issueDate: date ISO invalide (format YYYY-MM-DD)");
    if (row.recipientAddress.trim() && !isAddress(row.recipientAddress.trim())) errors.push("recipientAddress: adresse Ethereum invalide");
    return errors;
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Le fichier ne contient aucune feuille.");
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
      const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
      const extraColumns = headers.filter((column) => !requiredColumns.includes(column));
      if (missingColumns.length || extraColumns.length || headers.length !== requiredColumns.length) {
        const details = [
          missingColumns.length ? `manquantes : ${missingColumns.join(", ")}` : "",
          extraColumns.length ? `inattendues : ${extraColumns.join(", ")}` : ""
        ].filter(Boolean).join(" · ");
        throw new Error(`Les six colonnes attendues doivent être présentes une seule fois (${details || "colonnes en double"}).`);
      }
      const rows = records.map((record) => {
        const row = Object.fromEntries(requiredColumns.map((key) => [key, String(record[key] ?? "").trim()])) as Omit<CertificateRow, "errors">;
        return { ...row, errors: validateRow(row) };
      });
      const seen = new Set<string>();
      rows.forEach((row) => {
        if (!row.studentId) return;
        if (seen.has(row.studentId)) row.errors.push("studentId: doublon dans le fichier");
        seen.add(row.studentId);
      });
      if (publicClient && isAddress(contractAddress)) {
        await Promise.all(rows.map(async (row) => {
          if (!row.studentId || row.errors.some((entry) => entry.includes("doublon"))) return;
          try {
            const existing = await publicClient.readContract({ address: contractAddress, abi, functionName: "getCertIdByStudentId", args: [row.studentId] });
            if (existing !== 0n) row.errors.push(`studentId: déjà enregistré (certificat ${existing})`);
          } catch {
            row.errors.push("studentId: impossible de vérifier les doublons on-chain");
          }
        }));
      }
      setFileRows(rows);
      setSelected(rows.flatMap((row, index) => row.errors.length === 0 ? [index] : []));
      setTransactions([]);
      setNotice(`${rows.length} ligne(s) importée(s), ${rows.filter((row) => row.errors.length === 0).length} valide(s).`);
    } catch (cause) {
      setFileRows([]);
      setSelected([]);
      setError(cause instanceof Error ? cause.message : "Le fichier n’a pas pu être lu.");
    }
  }

  function toggleRow(index: number) {
    setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  }

  function toggleAll() {
    const valid = fileRows.flatMap((row, index) => row.errors.length === 0 ? [index] : []);
    setSelected(selected.length === valid.length ? [] : valid);
  }

  async function submitSingle(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const row = { ...form, recipientAddress: form.recipientAddress.trim() || address || "" };
    const issues = validateRow(row);
    if (!row.grade.trim()) issues.push("grade: champ obligatoire");
    if (issues.length) { setError(issues.join(" · ")); return; }
    if (!ready) { setError("Connectez un compte administrateur sur Hardhat Local."); return; }
    await sendChunks([{ ...row, errors: [] }], true);
  }

  async function issueSelected() {
    const rows = selected.map((index) => fileRows[index]).filter((row) => row && row.errors.length === 0);
    if (!rows.length) { setError("Sélectionnez au moins une ligne valide."); return; }
    if (!ready) { setError("Connectez un compte administrateur sur Hardhat Local."); return; }
    await sendChunks(rows, false);
  }

  async function sendChunks(rows: CertificateRow[], single: boolean) {
    if (!address || !publicClient) return;
    setError("");
    setTransactions([]);
    const chunkSize = single || mode === "single" ? 1 : Math.max(5, Math.min(15, batchSize));
    const chunks = Array.from({ length: Math.ceil(rows.length / chunkSize) }, (_, index) => rows.slice(index * chunkSize, (index + 1) * chunkSize));
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      let hash = "";
      try {
        hash = await writeContractAsync({
          address: contractAddress,
          abi,
          functionName: chunkSize === 1 ? "mintCertificate" : "batchMint",
          args: chunkSize === 1
            ? [getAddress(chunk[0].recipientAddress || address), chunk[0].studentName, chunk[0].studentId, chunk[0].diplomaTitle, chunk[0].issueDate, chunk[0].grade]
            : [
              chunk.map((row) => getAddress(row.recipientAddress || address)),
              chunk.map((row) => row.studentName),
              chunk.map((row) => row.studentId),
              chunk.map((row) => row.diplomaTitle),
              chunk.map((row) => row.issueDate),
              chunk.map((row) => row.grade)
            ]
        });
        setTransactions((current) => [...current, { hash, state: `Lot ${index + 1}/${chunks.length} en attente` }]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        if (receipt.status !== "success") throw new Error("Transaction révoquée ou échouée.");
        const mintEvent = parseAbiItem("event CertificateMinted(uint256 indexed certId, string studentId, address indexed recipient, string studentName, string diplomaTitle, string issueDate, string grade)");
        const certIds = receipt.logs.flatMap((log) => {
          try { return [String(parseEventLogs({ abi: [mintEvent], logs: [log] })[0]?.args.certId)]; } catch { return []; }
        });
        setTransactions((current) => current.map((item) => item.hash === hash ? { ...item, state: `Lot ${index + 1}/${chunks.length} confirmé`, certIds } : item));
      } catch (cause) {
        const text = cause instanceof Error ? cause.message : String(cause);
        if (hash) {
          setTransactions((current) => current.some((item) => item.hash === hash)
            ? current.map((item) => item.hash === hash ? { ...item, state: `Lot ${index + 1}/${chunks.length} échoué` } : item)
            : [...current, { hash, state: `Lot ${index + 1}/${chunks.length} échoué` }]);
        }
        setError(text.includes("DuplicateStudentId") ? "Échec : un identifiant étudiant existe déjà sur la blockchain." : text.includes("NotAdmin") ? "Échec : ce compte n’est plus administrateur." : `Émission interrompue au lot ${index + 1} : ${text}`);
        break;
      }
    }
    setNotice("Traitement des lots terminé. Consultez les statuts et identifiants ci-dessous.");
  }

  const selectableCount = useMemo(() => fileRows.filter((row) => row.errors.length === 0).length, [fileRows]);
  return <section className="page admin-page">
    <div className="hero"><span className="eyebrow">ESPACE SÉCURISÉ</span><h1>Administration des certificats.</h1><p>Émettez un certificat ou importez une promotion depuis un tableur.</p></div>
    <NetworkBanner />
    <WalletPanel />
    {isConnected && chainId === hardhat.id && !admin && <div className="alert warning">{checkingAdmin ? "Vérification des droits..." : "Ce compte n’est pas administrateur. Demandez à l’owner de l’ajouter au contrat."}</div>}
    {!isAddress(contractAddress) && <div className="alert warning">Contrat non déployé. Lancez le nœud Hardhat, puis le script de déploiement.</div>}
    <div className="admin-grid">
      <section className="card"><div className="section-title"><span className="step">01</span><div><h2>Émission unitaire</h2><p>Renseignez les informations du diplôme.</p></div></div>
        <form className="form-grid" onSubmit={submitSingle}>
          <label>Nom complet<input name="studentName" value={form.studentName} onChange={updateForm} required /></label>
          <label>Identifiant étudiant<input name="studentId" value={form.studentId} onChange={updateForm} required /></label>
          <label className="wide">Intitulé du diplôme<input name="diplomaTitle" value={form.diplomaTitle} onChange={updateForm} required /></label>
          <label>Date d’émission<input name="issueDate" type="date" value={form.issueDate} onChange={updateForm} required /></label>
          <label>Mention<select name="grade" value={form.grade} onChange={updateForm}><option value="">Choisir</option>{["Passable", "Assez Bien", "Bien", "Très Bien"].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
          <label className="wide">Adresse destinataire <span className="muted inline">(vide = votre adresse)</span><input name="recipientAddress" value={form.recipientAddress} onChange={updateForm} placeholder="0x..." /></label>
          <button className="button wide" disabled={!ready}>Émettre le certificat</button>
        </form>
      </section>
      <section className="card"><div className="section-title"><span className="step">02</span><div><h2>Import de promotion</h2><p>Fichier .xlsx ou .csv · validation avant émission.</p></div></div>
        <label className="upload-box"><span className="upload-icon">↑</span><b>Choisir un fichier Excel ou CSV</b><span className="muted">Colonnes requises, erreurs signalées ligne par ligne</span><input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} /></label>
        {fileRows.length > 0 && <>
          <div className="import-controls"><label><input type="checkbox" checked={selected.length === selectableCount && selectableCount > 0} onChange={toggleAll} /> Tout sélectionner ({selected.length}/{selectableCount})</label><div><label className="compact-label">Mode <select value={mode} onChange={(event) => setMode(event.target.value as "batch" | "single")}><option value="batch">Lots</option><option value="single">Unitaire</option></select></label>{mode === "batch" && <label className="compact-label">Taille <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))}>{[5, 10, 15].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>}</div></div>
          <div className="table-wrap"><table><thead><tr><th></th><th>Ligne</th><th>Étudiant / ID</th><th>Diplôme</th><th>Date</th><th>Validation</th></tr></thead><tbody>{fileRows.map((row, index) => <tr key={`${row.studentId}-${index}`} className={row.errors.length ? "invalid-row" : ""}><td><input type="checkbox" disabled={row.errors.length > 0} checked={selected.includes(index)} onChange={() => toggleRow(index)} /></td><td>{index + 2}</td><td><b>{row.studentName || "—"}</b><small>{row.studentId}</small></td><td>{row.diplomaTitle}</td><td>{row.issueDate}</td><td>{row.errors.length ? <span className="error-text">{row.errors.join("; ")}</span> : <span className="valid-text">Valide</span>}</td></tr>)}</tbody></table></div>
          <button className="button issue-button" disabled={!ready || selected.length === 0} onClick={issueSelected}>Émettre {selected.length} ligne(s) sélectionnée(s)</button>
        </>}
      </section>
    </div>
    {error && <div className="alert danger">{error}</div>}{notice && <div className="alert success">{notice}</div>}
    {transactions.length > 0 && <section className="card transactions"><h2>Suivi des transactions</h2>{transactions.map((transaction, index) => <div className="transaction" key={`${transaction.hash}-${index}`}><div><b>{transaction.state}</b><a href={`https://hardhat.local/tx/${transaction.hash}`} onClick={(event) => event.preventDefault()}>{transaction.hash}</a></div>{transaction.certIds && <span>Certificat(s) : {transaction.certIds.join(", ")}</span>}</div>)}</section>}
  </section>;
}

export default App;
