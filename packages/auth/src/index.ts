export function getToken() {
  return localStorage.getItem('oliver_token');
}

export function setToken(token: string) {
  localStorage.setItem('oliver_token', token);
}

export function logout() {
  localStorage.removeItem('oliver_token');
}
