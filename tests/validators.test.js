const { validateCard } = require('../src/utils/validators');
const assert = require('assert');

describe('Payment Validators', () => {
  it('should validate a valid card', () => {
    const card = { number: '4111111111111111', expiry: '12/25', cvv: '123' };
    assert.strictEqual(validateCard(card), true);
  });

  it('should reject an invalid card', () => {
    assert.strictEqual(validateCard(null), false);
    assert.strictEqual(validateCard({ number: '123' }), false);
  });
});
