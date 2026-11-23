<script setup>
import { ref, onMounted } from 'vue';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const notes = ref([]);
const title = ref('');
const content = ref('');
const error = ref('');

async function load() {
  try {
    const res = await fetch(`${API}/notes`);
    notes.value = await res.json();
  } catch (e) {
    error.value = 'Cannot reach the API';
  }
}

async function addNote() {
  if (!title.value.trim()) return;
  await fetch(`${API}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.value, content: content.value }),
  });
  title.value = '';
  content.value = '';
  load();
}

async function removeNote(id) {
  await fetch(`${API}/notes/${id}`, { method: 'DELETE' });
  load();
}

onMounted(load);
</script>

<template>
  <main>
    <h1>My Notes</h1>
    <form @submit.prevent="addNote">
      <input v-model="title" placeholder="Title" />
      <textarea v-model="content" placeholder="Content" rows="3"></textarea>
      <button type="submit">Add note</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <ul>
      <li v-for="n in notes" :key="n._id">
        <div>
          <strong>{{ n.title }}</strong>
          <p>{{ n.content }}</p>
        </div>
        <button class="del" @click="removeNote(n._id)">Delete</button>
      </li>
    </ul>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; background: #f4f5f7; margin: 0; }
main { max-width: 600px; margin: 40px auto; padding: 0 16px; }
form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
input, textarea { padding: 10px; border: 1px solid #ccc; border-radius: 6px; font: inherit; }
button { padding: 10px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
ul { list-style: none; padding: 0; }
li { display: flex; justify-content: space-between; gap: 12px; background: #fff; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; }
li p { margin: 4px 0 0; color: #555; }
.del { background: #dc2626; height: fit-content; }
.error { color: #dc2626; }
</style>
