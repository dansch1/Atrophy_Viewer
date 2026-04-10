import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type LoaderToken = string;

type LoaderEntry = {
	message?: string;
	updatedAt: number;
	onCancel?: () => void;
};

type GlobalLoaderApi = {
	start: (message?: string, onCancel?: () => void) => LoaderToken;
	update: (token: LoaderToken, message?: string) => void;
	stop: (token: LoaderToken) => void;
	cancel: (token: LoaderToken) => void;

	// convenience
	wrap: <T>(promise: Promise<T>, message?: string) => Promise<T>;

	isLoading: boolean;
	message?: string;
	canCancel: boolean;
	cancelCurrent: () => void;
};

const GlobalLoaderContext = createContext<GlobalLoaderApi | null>(null);

function now() {
	return Date.now();
}

function makeToken() {
	return `${now()}-${Math.random().toString(16).slice(2)}`;
}

export function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
	const [entries, setEntries] = useState<Map<LoaderToken, LoaderEntry>>(new Map());

	const start = useCallback((message?: string, onCancel?: () => void) => {
		const token = makeToken();
		setEntries((prev) => {
			const next = new Map(prev);
			next.set(token, { message, updatedAt: now(), onCancel });
			return next;
		});
		return token;
	}, []);

	const update = useCallback((token: LoaderToken, message?: string) => {
		setEntries((prev) => {
			const current = prev.get(token);
			if (!current) {
				return prev;
			}

			const next = new Map(prev);
			next.set(token, { ...current, message, updatedAt: now() });
			return next;
		});
	}, []);

	const stop = useCallback((token: LoaderToken) => {
		setEntries((prev) => {
			if (!prev.has(token)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(token);
			return next;
		});
	}, []);

	const cancel = useCallback(
		(token: LoaderToken) => {
			const entry = entries.get(token);
			entry?.onCancel?.();
		},
		[entries],
	);

	const wrap = useCallback(
		async <T,>(promise: Promise<T>, message?: string) => {
			const token = start(message);
			try {
				return await promise;
			} finally {
				stop(token);
			}
		},
		[start, stop],
	);

	const current = useMemo(() => {
		if (entries.size === 0) {
			return undefined;
		}

		let latestToken: LoaderToken | undefined;
		let latestEntry: LoaderEntry | undefined;

		for (const [token, entry] of entries.entries()) {
			if (!latestEntry || entry.updatedAt > latestEntry.updatedAt) {
				latestToken = token;
				latestEntry = entry;
			}
		}

		if (!latestToken || !latestEntry) {
			return undefined;
		}

		return { token: latestToken, entry: latestEntry };
	}, [entries]);

	const cancelCurrent = useCallback(() => {
		if (current?.entry.onCancel) {
			current.entry.onCancel();
		}
	}, [current]);

	const value = useMemo<GlobalLoaderApi>(
		() => ({
			start,
			update,
			stop,
			cancel,
			wrap,
			isLoading: !!current,
			message: current?.entry.message,
			canCancel: !!current?.entry.onCancel,
			cancelCurrent,
		}),
		[start, update, stop, cancel, wrap, current, cancelCurrent],
	);

	return <GlobalLoaderContext.Provider value={value}>{children}</GlobalLoaderContext.Provider>;
}

export function useGlobalLoader() {
	const ctx = useContext(GlobalLoaderContext);
	if (!ctx) {
		throw new Error("useGlobalLoader must be used within a GlobalLoaderProvider");
	}
	return ctx;
}
