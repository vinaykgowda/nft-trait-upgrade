// Property-based test generators for fast-check

import fc from 'fast-check';
import { CoreAsset, Trait, Purchase, Project } from '@/types';

export const solanaAddressArbitrary = fc.string({ minLength: 32, maxLength: 44 })
  .filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

export const coreAssetArbitrary: fc.Arbitrary<CoreAsset> = fc.record({
  address: solanaAddressArbitrary,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  image: fc.webUrl(),
  collection: fc.option(solanaAddressArbitrary),
  attributes: fc.option(fc.array(fc.record({
    trait_type: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.string({ minLength: 1, maxLength: 100 }),
  }))),
});

export const traitArbitrary: fc.Arbitrary<Partial<Trait>> = fc.record({
  id: fc.uuid(),
  slotId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  imageLayerUrl: fc.webUrl(),
  totalSupply: fc.option(fc.integer({ min: 1, max: 10000 })),
  remainingSupply: fc.option(fc.integer({ min: 0, max: 10000 })),
  priceAmount: fc.float({ min: 0.001, max: 1000 }).map(n => n.toFixed(3)), // Generate decimal string
  active: fc.boolean(),
});

export const projectArbitrary: fc.Arbitrary<Partial<Project>> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 })),
  logoUrl: fc.option(fc.webUrl()),
  collectionIds: fc.array(solanaAddressArbitrary, { minLength: 1, maxLength: 10 }),
  treasuryWallet: solanaAddressArbitrary,
});

export const purchaseArbitrary: fc.Arbitrary<Partial<Purchase>> = fc.record({
  id: fc.uuid(),
  walletAddress: solanaAddressArbitrary,
  assetId: solanaAddressArbitrary,
  traitId: fc.uuid(),
  priceAmount: fc.float({ min: 0.001, max: 1000 }).map(n => n.toFixed(3)), // Generate decimal string
  tokenId: fc.uuid(),
  status: fc.constantFrom('created', 'tx_built', 'confirmed', 'failed', 'fulfilled'),
  txSignature: fc.option(fc.string({ minLength: 64, maxLength: 88 })),
});