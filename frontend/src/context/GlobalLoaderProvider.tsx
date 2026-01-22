import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type LoaderToken = string;

type LoaderEntry = {
	message?: string;
	updatedAt: number;
};

type GlobalLoaderApi = {
	start: (message?: string) => LoaderToken;
	update: (token: LoaderToken, message?: string) => void;
	stop: (token: LoaderToken) => void;

	// convenience
	wrap: <T>(promise: Promise<T>, message?: string) => Promise<T>;

	isLoading: boolean;
	message?: string;
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

	const entriesRef = useRef(entries);
	entriesRef.current = entries;

	const start = useCallback((message?: string) => {
		const token = makeToken();
		setEntries((prev) => {
			const next = new Map(prev);
			next.set(token, { message, updatedAt: now() });
			return next;
		});
		return token;
	}, []);

	const update = useCallback((token: LoaderToken, message?: string) => {
		setEntries((prev) => {
			if (!prev.has(token)) {
				return prev;
			}
			const next = new Map(prev);
			next.set(token, { message, updatedAt: now() });
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

	const { isLoading, message } = useMemo(() => {
		if (entries.size === 0) {
			return { isLoading: false, message: undefined };
		}

		let latest: LoaderEntry | undefined;
		for (const e of entries.values()) {
			if (!latest || e.updatedAt > latest.updatedAt) {
				latest = e;
			}
		}

		return { isLoading: true, message: latest?.message };
	}, [entries]);

	const value = useMemo<GlobalLoaderApi>(
		() => ({ start, update, stop, wrap, isLoading, message }),
		[start, update, stop, wrap, isLoading, message],
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
