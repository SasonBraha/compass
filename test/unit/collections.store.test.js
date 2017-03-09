/* eslint no-unused-expressions: 0 */
const { expect } = require('chai');
const app = require('hadron-app');

require('../../src/app/reflux-listen-to-external-store.js');

const CollectionsStore = require('../../src/internal-packages/database/lib/stores/collections-store');
const InstanceStore = require('../../src/internal-packages/app/lib/stores/instance-store');
const { NamespaceStore } = require('hadron-reflux-store');

const mockDataService = require('./support/mock-data-service');

describe('CollectionsStore', () => {
  const appInstance = app.instance;
  const MOCK_APP_INSTANCE = {databases: ['foo-database']};

  before(mockDataService.before(null, {
    database: { collections: [] }
  }));
  after(mockDataService.after());

  beforeEach(() => {
    // Stub out the app.instance so the NamespaceStore.ns setup runs through
    app.instance = MOCK_APP_INSTANCE;
    NamespaceStore.ns = 'foo-database';
  });

  afterEach(() => {
    CollectionsStore.setState(CollectionsStore.getInitialState());
    app.instance = appInstance;
  });

  it('onInstanceChange with no databases renders an empty list', (done) => {
    const state = InstanceStore.getInitialState();
    expect(state.instance.databases.length).to.be.equal(0);

    CollectionsStore.onInstanceChange(state);
    setTimeout(() => {
      expect(CollectionsStore.state.collections.length).to.be.equal(0);
      done();
    }, 1);
  });
});
