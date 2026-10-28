import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {satisfies} from 'semver';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {experimental_scanPublicSdkOnly} from '@get-bb/plugin-sdk/testing';
import {mountHeaderSearch} from './header-search.ts';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const header = '<div data-testid="app-sidebar-top-reserve-row"><div data-sidebar-header-slot=""><button>New thread</button></div></div>';
const source = '<span data-nav-rail-item="__bb__/search-threads"><button aria-label="Search threads (Ctrl + K)" aria-keyshortcuts="Control+K"><svg></svg></button></span>';
const own = '[data-sidebar-search-button]';

function setup(t, html = header + source) {
  const dom = new JSDOM(html);
  const previous = globalThis.MutationObserver;
  globalThis.MutationObserver = dom.window.MutationObserver;
  const controller = new dom.window.AbortController();
  t.after(() => {
    controller.abort();
    globalThis.MutationObserver = previous;
    dom.window.close();
  });
  const dispose = mountHeaderSearch(dom.window.document, controller.signal);
  return {doc: dom.window.document, controller, dispose};
}

test('runs the current host search action and follows availability and shortcut changes', async t => {
  const {doc} = setup(t);
  let clicks = 0;
  let host = doc.querySelector('[data-nav-rail-item] button');
  host.onclick = () => clicks++;
  doc.querySelector(own).click();
  assert.equal(clicks, 1);
  host.disabled = true;
  host.setAttribute('aria-keyshortcuts', 'Alt+S');
  host.setAttribute('aria-label', 'Search threads (Alt + S)');
  await settle();
  assert.equal(doc.querySelector(own).disabled, true);
  assert.equal(doc.querySelector(own).getAttribute('aria-keyshortcuts'), 'Alt+S');
  doc.querySelector(own).click();
  assert.equal(clicks, 1);
  host.outerHTML = '<button aria-label="Search threads"></button>';
  await settle();
  host = doc.querySelector('[data-nav-rail-item] button');
  host.onclick = () => clicks += 10;
  doc.querySelector(own).click();
  assert.equal(clicks, 11);
  assert.equal(doc.querySelector(own).hasAttribute('aria-keyshortcuts'), false);
});

test('handles host redraws, multiple sidebars, late source mounting, and abort without duplicates', async t => {
  const {doc, controller, dispose} = setup(t, header);
  assert.equal(doc.querySelectorAll(own).length, 0);
  doc.body.insertAdjacentHTML('beforeend', source + header);
  await settle();
  assert.equal(doc.querySelectorAll(own).length, 2);
  doc.querySelector('[data-sidebar-header-slot]').replaceChildren();
  await settle();
  assert.equal(doc.querySelectorAll(own).length, 2);
  doc.querySelector('[data-testid="app-sidebar-top-reserve-row"]').outerHTML = header;
  await settle();
  assert.equal(doc.querySelectorAll(own).length, 2);
  const detached = doc.querySelector(own);
  let clicks = 0;
  doc.querySelector('[data-nav-rail-item] button').onclick = () => clicks++;
  controller.abort();
  dispose();
  detached.click();
  doc.body.insertAdjacentHTML('beforeend', header);
  await settle();
  assert.equal(clicks, 0);
  assert.equal(doc.querySelectorAll(own).length, 0);
});

test('does not leave a dead button when the host search control is removed', async t => {
  const {doc} = setup(t);
  doc.querySelector('[data-nav-rail-item]').remove();
  await settle();
  assert.equal(doc.querySelectorAll(own).length, 0);
  doc.body.insertAdjacentHTML('beforeend', source);
  await settle();
  assert.equal(doc.querySelectorAll(own).length, 1);
});

test('renders beside New thread in the BB 0.47.1 navigation header', t => {
  // BB 0.47 moved New thread into the Navigation plugin and renamed the test id.
  const currentHeader = '<div data-testid="app-sidebar-top-reserve-row"><div data-testid="sidebar-header-slot" data-sidebar-header-slot=""><div data-bb-plugin="navigation" class="contents"><button>New thread</button></div></div></div>';
  const {doc} = setup(t, currentHeader + source);
  const button = doc.querySelector(own);
  assert.ok(button, 'Поиск тредов должен появиться в заголовке BB 0.47.1');
  assert.equal(button.parentElement, doc.querySelector('[data-sidebar-header-slot]'));
  let clicks = 0;
  doc.querySelector('[data-nav-rail-item] button').onclick = () => clicks++;
  button.click();
  assert.equal(clicks, 1);
});

test('allows supported BB 0.47.1 and 0.48.0 releases in the plugin manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  for (const version of ['0.47.1', '0.48.0']) {
    assert.ok(satisfies(version, manifest.engines.bb), `BB ${version} must be allowed to load the plugin`);
  }
  assert.equal(satisfies('0.47.0', manifest.engines.bb), false);
  for (const version of ['0.6.79', '0.6.94']) {
    assert.ok(satisfies(version, manifest.engines.bbPluginSdk), `SDK ${version} must be allowed`);
  }
  assert.equal(satisfies('0.6.78', manifest.engines.bbPluginSdk), false);
});

test('imports only public SDK surfaces and package-local sources', async () => {
  const result = await experimental_scanPublicSdkOnly(process.cwd(), {allow: [/^(jsdom|semver)$/]});
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.privateDependencies, []);
});
