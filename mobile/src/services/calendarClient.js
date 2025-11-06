import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();
const NOTES_ENDPOINT = `${API_BASE_URL}/api/calendar-notes`;

async function handleResponse(response) {
  if (!response.ok) {
    const message = `Server returned ${response.status}`;
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function listCalendarNotes() {
  const response = await fetch(NOTES_ENDPOINT);
  return handleResponse(response);
}

export async function createCalendarNote(payload) {
  const response = await fetch(NOTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateCalendarNote(id, payload) {
  const response = await fetch(`${NOTES_ENDPOINT}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteCalendarNote(id) {
  const response = await fetch(`${NOTES_ENDPOINT}/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}
