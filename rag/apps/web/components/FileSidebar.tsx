import { useCallback, useEffect, useRef, useState } from "react";
import { type DocumentInfo, ingestDocument, listDocuments } from "../lib/api";

type FileEntry = {
	key: string;
	filename: string;
	hash?: string;
	docId?: number;
	status: "ready" | "queued" | "extracting" | "error";
	detail?: string;
};

async function fileHash(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

type Props = {
	activeDocId: number | null;
	onSelectDoc: (doc: DocumentInfo) => void;
};

let entrySeq = 0;

export function FileSidebar({ activeDocId, onSelectDoc }: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [documents, setDocuments] = useState<DocumentInfo[]>([]);
	const fileRef = useRef<HTMLInputElement>(null);

	const refreshDocs = useCallback(async () => {
		const docs = await listDocuments();
		setDocuments(docs);
		setEntries((prev) => {
			const uploading = prev.filter(
				(e) => e.status === "queued" && !docs.some((d) => d.id === e.docId),
			);
			const fromApi: FileEntry[] = docs.map((d) => ({
				key: `doc-${d.id}`,
				filename: d.filename,
				docId: d.id,
				status: d.status === "ready" ? "ready" : "extracting",
			}));
			return [...uploading, ...fromApi];
		});
	}, []);

	useEffect(() => {
		refreshDocs();
	}, [refreshDocs]);

	// Auto-poll while any documents are still processing
	useEffect(() => {
		const hasProcessing = entries.some((e) => e.status === "extracting");
		if (!hasProcessing) return;
		const interval = setInterval(refreshDocs, 3000);
		return () => clearInterval(interval);
	}, [entries, refreshDocs]);

	function updateEntry(key: string, update: Partial<FileEntry>) {
		setEntries((prev) =>
			prev.map((e) => (e.key === key ? { ...e, ...update } : e)),
		);
	}

	async function processFile(file: File, key: string) {
		console.log(
			`[upload] processFile called: ${file.name} (${file.size} bytes) key=${key}`,
		);
		try {
			updateEntry(key, { status: "extracting" });
			console.log(`[upload] Calling ingestDocument...`);
			const result = await ingestDocument(file);
			console.log(`[upload] Upload complete: docId=${result.documentId}`);
			updateEntry(key, { status: "extracting", docId: result.documentId });
			refreshDocs();
		} catch (err) {
			console.error(`[upload] Failed:`, err);
			updateEntry(key, {
				status: "error",
				detail: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleFiles(files: FileList) {
		const docxFiles = Array.from(files).filter((f) => f.name.endsWith(".docx"));
		console.log(`[upload] handleFiles: ${docxFiles.length} .docx files`);
		if (docxFiles.length === 0) return;

		// Hash files and filter out duplicates
		const hashes = await Promise.all(docxFiles.map((f) => fileHash(f)));
		const existingHashes = new Set(entries.map((e) => e.hash).filter(Boolean));
		const jobs: { file: File; key: string; hash: string }[] = [];

		for (let i = 0; i < docxFiles.length; i++) {
			if (existingHashes.has(hashes[i])) {
				console.log(`[upload] Skipping duplicate: ${docxFiles[i].name}`);
				continue;
			}
			const key = `upload-${++entrySeq}`;
			jobs.push({ file: docxFiles[i], key, hash: hashes[i] });
			existingHashes.add(hashes[i]);
		}

		if (jobs.length === 0) return;

		setEntries((prev) => [
			...prev,
			...jobs.map((j) => ({
				key: j.key,
				filename: j.file.name,
				hash: j.hash,
				status: "queued" as const,
			})),
		]);

		console.log(`[upload] Starting ${jobs.length} uploads`);
		await Promise.all(jobs.map((j) => processFile(j.file, j.key)));
	}

	function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.files?.length) {
			handleFiles(e.target.files);
			e.target.value = "";
		}
	}

	function handleClick(entry: FileEntry) {
		if (entry.status !== "ready" || !entry.docId) return;
		const doc = documents.find((d) => d.id === entry.docId);
		if (doc) onSelectDoc(doc);
	}

	const STATUS_LABEL: Record<string, string> = {
		queued: "Queued",
		extracting: "Processing...",
		error: "Error",
	};

	return (
		<div className="file-sidebar">
			<div className="file-sidebar-header">
				<span className="file-sidebar-title">Documents</span>
				<input
					ref={fileRef}
					type="file"
					accept=".docx"
					multiple
					hidden
					onChange={handleFileInput}
				/>
				<button
					type="button"
					className="btn-upload"
					onClick={() => fileRef.current?.click()}
				>
					+ Add
				</button>
			</div>
			<div className="file-list">
				{entries.length === 0 && (
					<div className="file-empty">No documents yet</div>
				)}
				{entries.map((entry) => (
					<button
						type="button"
						key={entry.key}
						className={`file-item ${entry.docId === activeDocId ? "active" : ""} ${entry.status !== "ready" ? "file-item--processing" : ""}`}
						onClick={() => handleClick(entry)}
						disabled={entry.status !== "ready"}
					>
						<span className="file-item-name">
							<span
								className={`file-item-dot file-item-dot--${entry.status}`}
							/>
							{entry.filename}
						</span>
						{entry.status !== "ready" && (
							<span className="file-item-progress">
								{entry.detail ?? STATUS_LABEL[entry.status]}
							</span>
						)}
					</button>
				))}
			</div>
		</div>
	);
}
