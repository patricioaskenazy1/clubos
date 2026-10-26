import React, { useEffect, useState } from "react";
import { api, CsvEntity, CsvImportResult } from "../api";

// Las planillas de Excel en español suelen guardarse como CSV en Windows-1252
// y no en UTF-8: probamos UTF-8 estricto y, si falla, caemos a Windows-1252
// para no ver "Gómez" como "G?mez".
async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export default function Importar() {
  const [entities, setEntities] = useState<CsvEntity[]>([]);
  const [entity, setEntity] = useState<string>("");
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listCsvEntities()
      .then((list) => {
        setEntities(list);
        if (list.length > 0) setEntity(list[0].key);
      })
      .catch((e) => setError(e.message));
  }, []);

  function reset() {
    setCsv(null);
    setFileName("");
    setResult(null);
    setError(null);
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const blob = await api.csvTemplate(entity);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla-${entity}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar la plantilla");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const text = await readCsvFile(file);
      setCsv(text);
      setFileName(file.name);
      setResult(await api.importCsv(entity, text, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function confirm() {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.importCsv(entity, csv, false));
      setCsv(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  }

  const current = entities.find((e) => e.key === entity);
  const ready = !!csv && !!result && result.dryRun && result.errors.length === 0 && result.valid > 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Importar planillas</h2>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="hint-text" style={{ marginBottom: 12 }}>
          Subi una planilla de Excel o Google Sheets guardada como CSV. Primero se revisa fila por fila; si hay un error no se guarda nada y te mostramos que corregir.
        </p>
        {entities.length === 0 && !error && <p className="empty-state">Tu rol no tiene planillas para importar.</p>}
        {entities.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={entity} onChange={(e) => { setEntity(e.target.value); reset(); }} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                {entities.map((e) => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={downloadTemplate}>Descargar plantilla</button>
              <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                {busy ? "Procesando..." : "Elegir archivo CSV"}
                <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ display: "none" }} />
              </label>
            </div>
            {current && <p className="hint-text" style={{ marginTop: 10 }}>Columnas: {current.columns.join(", ")}</p>}
          </>
        )}
        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      </div>

      {result && (
        <div className="card">
          {result.imported > 0 ? (
            <h3 style={{ fontSize: 16, color: "var(--green)" }}>Se importaron {result.imported} filas.</h3>
          ) : (
            <h3 style={{ fontSize: 16 }}>
              {fileName}: {result.valid} de {result.total} filas estan bien
            </h3>
          )}

          {result.ignoredColumns.length > 0 && (
            <p className="hint-text" style={{ marginTop: 8 }}>
              Se ignoraron estas columnas porque no las reconocemos: {result.ignoredColumns.join(", ")}.
            </p>
          )}

          {result.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p className="error-text">Corregi estas filas y volve a subir el archivo. No se guardo nada.</p>
              {result.errors.slice(0, 50).map((er) => (
                <div className="activity-row" key={er.row}>
                  <span className="hint-text" style={{ width: 80, flexShrink: 0 }}>Fila {er.row}</span>
                  <span>{er.message}</span>
                </div>
              ))}
              {result.errors.length > 50 && <p className="hint-text">Y {result.errors.length - 50} errores mas.</p>}
            </div>
          )}

          {ready && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                {busy ? "Importando..." : `Importar ${result.valid} filas`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
