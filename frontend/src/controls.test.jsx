import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { renderToStaticMarkup } from 'react-dom/server';
import axios from 'axios';
import App from './App';
import AIPresetButtons, { presetValues } from './components/AIPresetButtons';
import FormattedAIReport from './components/FormattedAIReport';
import GenericList from './components/GenericList';
import { ToastProvider } from './components/Toast';
import api from './api';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); localStorage.clear(); });
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

test('both presets fill optional and required fields while preserving the selected customer and never submitting', () => {
  const submit = jest.fn();
  function Fixture() {
    const [form, setForm] = useState({ customer_id: 'existing-record', subject: '', description: '', priority: '' });
    return <form onSubmit={submit}><AIPresetButtons form={form} setForm={setForm} formName="TicketForm" /><input aria-label="subject" value={form.subject} readOnly /><input aria-label="description" value={form.description} readOnly /><input aria-label="customer" value={form.customer_id} readOnly /></form>;
  }
  act(() => root.render(<Fixture />));
  const buttons = host.querySelectorAll('button');
  expect(buttons).toHaveLength(2);
  act(() => buttons[0].click());
  expect(host.querySelector('[aria-label="subject"]').value).toBeTruthy();
  expect(host.querySelector('[aria-label="description"]').value).toBeTruthy();
  expect(host.querySelector('[aria-label="customer"]').value).toBe('existing-record');
  const first = host.querySelector('[aria-label="subject"]').value;
  act(() => buttons[1].click());
  expect(host.querySelector('[aria-label="subject"]').value).not.toBe(first);
  expect(submit).not.toHaveBeenCalled();
  expect(presetValues({ customer_id: '', subject: '' }, 0, 'TicketForm').customer_id).toBe('');
});

test('structured returned and saved JSON renders nested facts, lists, tables, false, zero and empty string', () => {
  const fixture = { summary: '', active: false, count: 0, nested: { flagged: false, total: 0, note: '' }, actions: ['Call customer'], rows: [{ label: 'A', count: 0 }, { label: 'B', count: 2 }] };
  for (const response of [fixture, JSON.stringify(fixture)]) {
    const html = renderToStaticMarkup(<FormattedAIReport response={response} />);
    expect(html).toContain('Summary');
    expect(html).toContain('Active');
    expect(html).toContain('No');
    expect(html).toContain('0');
    expect(html).toContain('Call customer');
    expect(html).toContain('<table');
    expect(html).not.toContain('{&quot;');
  }
});

test('demo fill populates configured fixture credentials without posting or submitting', async () => {
  process.env.REACT_APP_DEMO_EMAIL = 'fixture@example.test';
  process.env.REACT_APP_DEMO_PASSWORD = 'fixture-only-password';
  window.history.pushState({}, '', '/login');
  const post = jest.spyOn(axios, 'post').mockImplementation(() => Promise.reject(new Error('unexpected post')));
  await act(async () => root.render(<App />));
  const button = [...host.querySelectorAll('button')].find((node) => node.textContent.includes('Fill demo credentials'));
  expect(button).toBeTruthy();
  await act(async () => button.click());
  expect(host.querySelector('input[type="email"]').value).toBe('fixture@example.test');
  expect(host.querySelector('input[type="password"]').value).toBe('fixture-only-password');
  expect(post).not.toHaveBeenCalled();
  delete process.env.REACT_APP_DEMO_EMAIL;
  delete process.env.REACT_APP_DEMO_PASSWORD;
});

test('saved history detail renders structured AI data from the record', async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'existing-record', name: 'Fixture account', ai_response: JSON.stringify({ active: false, count: 0, actions: ['Review usage'] }) }] });
  await act(async () => root.render(<ToastProvider><GenericList title="History" apiEndpoint="/fixture" columns={[{ key: 'name', label: 'Name' }]} detailFields={[{ key: 'name', label: 'Name' }]} FormComponent={() => null} /></ToastProvider>));
  await act(async () => host.querySelector('td:nth-child(2)').click());
  expect(host.textContent).toContain('Saved AI analysis');
  expect(host.textContent).toContain('Active');
  expect(host.textContent).toContain('No');
  expect(host.textContent).toContain('0');
  expect(host.textContent).toContain('Review usage');
});

test('missing demo credentials are explained and the login form stays untouched', async () => {
  delete process.env.REACT_APP_DEMO_EMAIL;
  delete process.env.REACT_APP_DEMO_PASSWORD;
  window.history.pushState({}, '', '/login');
  const post = jest.spyOn(axios, 'post').mockImplementation(() => Promise.reject(new Error('unexpected post')));
  await act(async () => root.render(<App />));
  const button = [...host.querySelectorAll('button')].find((node) => node.textContent.includes('Fill demo credentials'));
  await act(async () => button.click());
  expect(host.textContent).toContain('Demo credentials are not configured');
  expect(host.querySelector('input[type="email"]').value).toBe('');
  expect(post).not.toHaveBeenCalled();
});
