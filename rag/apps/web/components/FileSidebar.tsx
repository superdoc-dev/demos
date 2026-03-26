import { useCallback, useEffect, useRef, useState } from "react";
import {
	type DocumentInfo,
	deleteDocument,
	ingestDocument,
	listDocuments,
} from "../lib/api";

type FileEntry = {
	key: string;
	filename: string;
	hash?: string;
	docId?: number;
	status: "ready" | "queued" | "extracting" | "indexing" | "deleting" | "error";
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
	onReadyChange: (hasReady: boolean) => void;
};

let entrySeq = 0;

export function FileSidebar({
	activeDocId,
	onSelectDoc,
	onReadyChange,
}: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [documents, setDocuments] = useState<DocumentInfo[]>([]);
	const [vectorCount, setVectorCount] = useState(0);
	const [chunkCount, setChunkCount] = useState(0);
	const fileRef = useRef<HTMLInputElement>(null);

	const refreshDocs = useCallback(async () => {
		const resp = await listDocuments();
		setDocuments(resp.documents);
		setVectorCount(resp.vectorCount);
		setChunkCount(resp.chunkCount);
		setEntries((prev) => {
			const uploading = prev.filter(
				(e) =>
					e.status === "queued" &&
					!resp.documents.some((d) => d.id === e.docId),
			);
			const deleting = prev.filter((e) => e.status === "deleting");
			const deletingIds = new Set(deleting.map((e) => e.docId));
			const fromApi: FileEntry[] = resp.documents
				.filter((d) => !deletingIds.has(d.id))
				.map((d) => {
					let status: FileEntry["status"];
					let detail: string | undefined;
					if (d.status === "error") {
						status = "error";
						detail = "Processing failed";
					} else if (
						d.status === "ready" &&
						resp.chunkCount > 0 &&
						resp.vectorCount < resp.chunkCount
					) {
						status = "indexing";
					} else if (d.status === "ready") {
						status = "ready";
					} else {
						status = "extracting";
					}
					return {
						key: `doc-${d.id}`,
						filename: d.filename,
						docId: d.id,
						status,
						detail,
					};
				});
			return [...uploading, ...deleting, ...fromApi];
		});
	}, []);

	useEffect(() => {
		refreshDocs();
	}, [refreshDocs]);

	// Notify parent when documents are ready AND vectors are fully indexed
	const indexed = chunkCount > 0 && vectorCount >= chunkCount;
	useEffect(() => {
		const hasReady = entries.some((e) => e.status === "ready");
		onReadyChange(hasReady && indexed);
	}, [entries, indexed, onReadyChange]);

	// Auto-poll while documents are processing or vectors are not yet indexed
	useEffect(() => {
		const needsPoll = entries.some(
			(e) => e.status === "extracting" || e.status === "indexing",
		);
		if (!needsPoll) return;
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
		if (
			(entry.status !== "ready" && entry.status !== "indexing") ||
			!entry.docId
		)
			return;
		const doc = documents.find((d) => d.id === entry.docId);
		if (doc) onSelectDoc(doc);
	}

	async function handleDelete(e: React.MouseEvent, entry: FileEntry) {
		e.stopPropagation();
		if (!entry.docId) return;
		updateEntry(entry.key, { status: "deleting" });
		if (entry.docId === activeDocId) onSelectDoc({ id: 0 } as DocumentInfo);
		try {
			await deleteDocument(entry.docId);
			setEntries((prev) => prev.filter((en) => en.key !== entry.key));
		} catch (err) {
			console.error("[delete] Failed:", err);
			updateEntry(entry.key, { status: "ready" });
		}
	}

	const STATUS_LABEL: Record<string, string> = {
		queued: "Queued",
		extracting: "Processing...",
		indexing: "Indexing...",
		deleting: "Removing...",
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
					<div
						key={entry.key}
						className={`file-item ${entry.docId === activeDocId && (entry.status === "ready" || entry.status === "indexing") ? "active" : ""} ${entry.status === "error" ? "file-item--error" : entry.status === "indexing" ? "file-item--indexing" : entry.status !== "ready" ? "file-item--processing" : ""}`}
					>
						<button
							type="button"
							className="file-item-btn"
							onClick={() => handleClick(entry)}
							disabled={entry.status !== "ready" && entry.status !== "indexing"}
						>
							<span
								className={`file-item-dot file-item-dot--${entry.status}`}
							/>
							<span className="file-item-label">{entry.filename}</span>
						</button>
						{entry.status !== "deleting" && entry.docId && (
							<button
								type="button"
								className="file-item-delete"
								onClick={(e) => handleDelete(e, entry)}
								title="Remove document"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						)}
						{entry.status !== "ready" && (
							<span className="file-item-progress">
								{entry.detail ?? STATUS_LABEL[entry.status]}
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
