// Обращения к серверу. Ошибки приходят с понятным текстом на русском.

export class ApiError extends Error {
    constructor(message, status, fields) {
        super(message);
        this.status = status;
        this.fields = fields || {};
    }
}

async function request(method, url, body, isForm = false) {
    const opts = { method, headers: { Accept: 'application/json' } };
    if (body !== undefined) {
        if (isForm) opts.body = body;
        else {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
    }
    let res;
    try {
        res = await fetch(url, opts);
    } catch (e) {
        throw new ApiError('Нет связи с сервером. Проверьте, что программа запущена', 0);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!res.ok) {
        const msg = data && data.message ? data.message
            : res.status === 404 ? 'Не найдено — возможно, запись уже удалена'
            : 'Сервер ответил ошибкой. Попробуйте ещё раз';
        throw new ApiError(msg, res.status, data && data.fields);
    }
    return data;
}

export const api = {
    get: url => request('GET', url),
    post: (url, body) => request('POST', url, body ?? {}),
    put: (url, body) => request('PUT', url, body),
    del: url => request('DELETE', url),
    upload: (url, files) => {
        const fd = new FormData();
        [...files].forEach(f => fd.append('files', f));
        return request('POST', url, fd, true);
    },
};

/** Скачивание файла отчёта (Excel / PDF) без перехода со страницы. */
export async function download(url) {
    const res = await fetch(url);
    if (!res.ok) {
        let msg = 'Не удалось сформировать файл';
        try { msg = (await res.json()).message || msg; } catch { /* не JSON */ }
        throw new ApiError(msg, res.status);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    let name = 'report';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
    if (m) name = decodeURIComponent(m[1]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
