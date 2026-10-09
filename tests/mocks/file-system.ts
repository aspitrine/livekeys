/**
 * In-memory stand-in for `expo-file-system`: files are paths with a size, and downloads are driven by the test
 * (`progress`, `finish`, `fail`). The app's file logic (partial files, size check, move, cleanup) stays real.
 * Use with `jest.mock('expo-file-system', () => require('../mocks/file-system'))`.
 */
type Part = string | { uri: string };

const files = new Map<string, number>();
const contents = new Map<string, string>();
const dirs = new Set<string>();
const downloads: DownloadTask[] = [];

const join = (parts: Part[]) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');

export const Paths = { document: '/documents', cache: '/cache' };

export class Directory {
  uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get exists() {
    return dirs.has(this.uri);
  }
  create() {
    dirs.add(this.uri);
  }
}

export class File {
  uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get exists() {
    return files.has(this.uri);
  }
  get size() {
    return files.get(this.uri) ?? 0;
  }
  create() {
    files.set(this.uri, 0);
  }
  write(text: string) {
    files.set(this.uri, text.length);
    contents.set(this.uri, text);
  }
  delete() {
    files.delete(this.uri);
    contents.delete(this.uri);
  }
  /** Document picker: the test sets what it returns. */
  static pickFileAsync = jest.fn();
  move(target: File) {
    files.set(target.uri, this.size);
    files.delete(this.uri);
    this.uri = target.uri;
  }
}

type Progress = { bytesWritten: number; totalBytes: number };

export class DownloadTask {
  state: 'pending' | 'done' | 'cancelled' = 'pending';
  private settle!: { resolve: (r: { uri: string } | null) => void; reject: (e: Error) => void };
  constructor(
    readonly url: string,
    readonly file: File,
    readonly options: { onProgress?: (p: Progress) => void },
  ) {
    downloads.push(this);
  }
  downloadAsync() {
    return new Promise<{ uri: string } | null>((resolve, reject) => {
      this.settle = { resolve, reject };
    });
  }
  /** The server sent `bytes` of `total`. */
  progress(bytes: number, total: number) {
    this.options.onProgress?.({ bytesWritten: bytes, totalBytes: total });
  }
  /** The download ends with `bytes` written to the partial file. */
  finish(bytes: number) {
    files.set(this.file.uri, bytes);
    this.state = 'done';
    this.settle.resolve({ uri: this.file.uri });
  }
  fail(message: string) {
    files.set(this.file.uri, 1);
    this.settle.reject(new Error(message));
  }
  cancel() {
    this.state = 'cancelled';
    this.settle.resolve(null);
  }
}

/** Test controls: inspect or seed the fake disk and the downloads started by the app. */
export const fakeFileSystem = {
  files,
  contents,
  downloads,
  reset() {
    files.clear();
    contents.clear();
    dirs.clear();
    downloads.length = 0;
  },
};
