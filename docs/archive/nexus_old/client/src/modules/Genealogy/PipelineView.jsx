import { useState, useEffect, useRef } from 'react';
import { genealogy } from '../../api.js';
import styles from './PipelineView.module.css';

export default function PipelineView() {
  const [runLog, setRunLog] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [jsonPath, setJsonPath] = useState('');
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  const fileRef = useRef();
  const pollRef = useRef();

  function loadLog() {
    genealogy.log()
      .then(data => setRunLog(data || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadLog();
    return () => clearInterval(pollRef.current);
  }, []);

  // Poll active run
  useEffect(() => {
    if (!activeRunId) return;
    pollRef.current = setInterval(() => {
      genealogy.logEntry(activeRunId)
        .then(entry => {
          setRunLog(prev => prev.map(r => r.id === activeRunId ? entry : r));
          if (entry.status !== 'running') {
            clearInterval(pollRef.current);
            setActiveRunId(null);
            setRunning(false);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [activeRunId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await genealogy.upload(file);
      setUploadResult(result);
    } catch (err) {
      setUploadResult({ ok: false, message: err.message });
    }
    setUploading(false);
  }

  async function handleRun(e) {
    e.preventDefault();
    if (!jsonPath.trim()) return;
    setRunning(true);
    try {
      const result = await genealogy.run(jsonPath.trim());
      if (result.ok) {
        setActiveRunId(result.runId);
        setRunLog(prev => [{
          id: result.runId,
          startedAt: new Date().toISOString(),
          jsonFile: jsonPath.trim(),
          status: 'running',
          output: [],
          error: null,
          finishedAt: null,
        }, ...prev]);
      }
    } catch {
      setRunning(false);
    }
  }

  function statusBadge(status) {
    if (status === 'running') return <span className="badge badge-blue">Running...</span>;
    if (status === 'success') return <span className="badge badge-green">Success</span>;
    if (status === 'error')   return <span className="badge badge-red">Error</span>;
    return <span className="badge badge-gray">{status}</span>;
  }

  return (
    <div>
      {/* Step 1: Upload */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNum}>1</span>
          <h3 className={styles.stepTitle}>Upload document</h3>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          Upload a genealogy document. The file will be saved to OneDrive /Genealogy/Inbox/ for extraction in Claude Projects.
        </p>
        <div className={styles.uploadArea} onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload}
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.docx,.txt" />
          {uploading
            ? <p className="text-muted">Uploading...</p>
            : <p className="text-muted">Click to select a document (PDF, image, Word, text)</p>
          }
        </div>
        {uploadResult && (
          <div className={`${styles.uploadResult} ${uploadResult.ok ? styles.uploadOk : styles.uploadErr}`}>
            {uploadResult.ok ? (
              <>
                <p className="font-medium text-sm">✓ Uploaded: {uploadResult.originalName}</p>
                <p className="text-sm text-muted">{uploadResult.message}</p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--red)' }}>Upload failed: {uploadResult.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Extract (Claude Projects) */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNum}>2</span>
          <h3 className={styles.stepTitle}>Extract in Claude Projects</h3>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
          Open Claude Projects → Genealogy Document Extractions and run the extraction. Claude will produce a JSON file and OneNote page.
        </p>
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalLink}
        >
          Open Claude Projects ↗
        </a>
      </div>

      {/* Step 3: Review JSON */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNum}>3</span>
          <h3 className={styles.stepTitle}>Review JSON in PowerShell</h3>
        </div>
        <p className="text-muted text-sm">
          Review and edit the extracted JSON interactively via PowerShell before pushing to Airtable.
          The JSON file will be at <code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 4, fontSize: 12 }}>OneDrive/Genealogy/Inbox/</code>.
        </p>
      </div>

      {/* Step 4: Push to Airtable */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNum}>4</span>
          <h3 className={styles.stepTitle}>Push to Airtable</h3>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          Enter the full path to the reviewed JSON file and trigger the PowerShell pipeline.
        </p>
        <form onSubmit={handleRun} className={styles.runForm}>
          <input
            type="text"
            placeholder="C:\Users\...\OneDrive\Genealogy\Inbox\extraction.json"
            value={jsonPath}
            onChange={e => setJsonPath(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className={styles.runBtn} disabled={running || !jsonPath.trim()}>
            {running ? 'Running...' : '▶ Run pipeline'}
          </button>
        </form>
        <div className={styles.reminder}>
          <p className="text-xs text-faint">⚠ Remember: Enter results manually in Legacy Family Tree after pushing to Airtable</p>
        </div>
      </div>

      {/* Run log */}
      {runLog.length > 0 && (
        <div className={styles.logSection}>
          <h3 className={styles.logTitle}>Pipeline run log</h3>
          {runLog.map(run => (
            <div key={run.id} className={styles.logEntry}>
              <div className={styles.logEntryHeader}>
                <span className="text-sm font-medium">{run.jsonFile.split('\\').pop()}</span>
                {statusBadge(run.status)}
                <span className="text-xs text-faint">
                  {new Date(run.startedAt).toLocaleTimeString()}
                </span>
              </div>
              {run.output.length > 0 && (
                <pre className={styles.logOutput}>
                  {run.output.join('').slice(-1000)}
                </pre>
              )}
              {run.error && <p className="text-xs" style={{ color: 'var(--red)', marginTop: 4 }}>{run.error}</p>}
              {run.finishedAt && (
                <p className="text-xs text-faint">
                  Finished {new Date(run.finishedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
