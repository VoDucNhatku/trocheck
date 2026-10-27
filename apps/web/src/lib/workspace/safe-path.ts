/** Restrict return navigation to app paths; reject browser URL normalisation tricks. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/phan-tich';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020]/.test(decoded)) return '/phan-tich';
    const url = new URL(value, 'https://rener.invalid');
    if (url.origin !== 'https://rener.invalid' || url.pathname.startsWith('/api/') || url.pathname === '/dang-nhap') return '/phan-tich';
    return url.pathname + url.search + url.hash;
  } catch { return '/phan-tich'; }
}

/** No arbitrary proxy URL or endpoint: only workspace capabilities already in FastAPI. */
export function workspaceRouteAllowed(path: string, method: string): boolean {
  const id = '[a-zA-Z0-9_-]{1,200}';
  const rules: Record<string, RegExp[]> = {
    GET: [/^auth\/me$/, new RegExp('^analyses/' + id + '$'), /^market\/summary$/, /^team\/posts$/, /^team\/reviews$/,
      new RegExp('^team/reviews/' + id + '$'), /^team\/extension-tokens$/, /^team\/export$/,
      new RegExp('^listings/' + id + '/comparison$'), new RegExp('^lab/gold/' + id + '$'), /^eval\/runs$/, new RegExp('^eval/runs/' + id + '$')],
    POST: [/^auth\/(login|logout)$/, /^analyses$/, new RegExp('^analyses/' + id + '/contribute$'),
      /^team\/extension-tokens$/, new RegExp('^team/posts/' + id + '/reprocess$'), new RegExp('^team/reviews/' + id + '/decision$'), /^lab\/run$/],
    DELETE: [new RegExp('^team/extension-tokens/' + id + '$')],
  };
  return rules[method]?.some(rule => rule.test(path)) ?? false;
}
