// Paths in media.json are relative to /public; BASE_URL makes them work from any host/subfolder.
export const asset = (path) => (path ? `${import.meta.env.BASE_URL}${path}` : null)
