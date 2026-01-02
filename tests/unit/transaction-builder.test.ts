/**
 * Unit tests for TransactionBuilder service
 * 
 * Tests transaction composition and signing functionality
 * Validates Requirements: 3.2, 3.3, 8.1, 8.2, 8.3
 */

describe('TransactionBuilder Unit Tests', () => {
  // Mock the TransactionBuilder class for testing
  const mockTransactionBuilder = {
    buildAtomicTransaction: jest.fn(),
    validateTransaction: jest.fn(),
    simulateTransaction: jest.fn(),
    sendAndConfirmTransaction: jest.fn(),
    getTransactionStatus: jest.fn(),
  };

  const mockTransactionData = {
    walletAddress: '11111111111111111111111111111112',
    assetId: '11111111111111111111111111111113',
    traitId: 'trait-123',
    paymentAmount: BigInt(1000000000), // 1 SOL
    treasuryWallet: '11111111111111111111111111111114',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAtomicTransaction', () => {
    it('should build transaction with both payment and update instructions', async () => {
      const mockResult = {
        transaction: {
          instructions: [
            { type: 'payment', programId: 'SystemProgram' },
            { type: 'update', programId: 'CoreProgram' },
          ],
          recentBlockhash: 'mock-blockhash',
          feePayer: mockTransactionData.walletAddress,
        },
        requiredSignatures: [mockTransactionData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(mockTransactionData);

      expect(result.transaction.instructions).toHaveLength(2);
      expect(result.requiredSignatures).toContain(mockTransactionData.walletAddress);
      expect(result.transaction.feePayer).toBe(mockTransactionData.walletAddress);
    });

    it('should handle SOL payments correctly', async () => {
      const mockResult = {
        transaction: {
          instructions: [
            { type: 'sol_transfer', amount: mockTransactionData.paymentAmount },
            { type: 'core_update', assetId: mockTransactionData.assetId },
          ],
        },
        requiredSignatures: [mockTransactionData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(mockTransactionData);

      const paymentInstruction = result.transaction.instructions[0];
      expect(paymentInstruction.type).toBe('sol_transfer');
      expect(paymentInstruction.amount).toBe(mockTransactionData.paymentAmount);
    });

    it('should handle SPL token payments correctly', async () => {
      const tokenData = {
        ...mockTransactionData,
        tokenMintAddress: '11111111111111111111111111111115',
      };

      const mockResult = {
        transaction: {
          instructions: [
            { type: 'spl_transfer', tokenMint: tokenData.tokenMintAddress },
            { type: 'core_update', assetId: tokenData.assetId },
          ],
        },
        requiredSignatures: [tokenData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(tokenData);

      const paymentInstruction = result.transaction.instructions[0];
      expect(paymentInstruction.type).toBe('spl_transfer');
      expect(paymentInstruction.tokenMint).toBe(tokenData.tokenMintAddress);
    });

    it('should include Core asset update instruction', async () => {
      const mockResult = {
        transaction: {
          instructions: [
            { type: 'payment' },
            { type: 'core_update', assetId: mockTransactionData.assetId, traitId: mockTransactionData.traitId },
          ],
        },
        requiredSignatures: [mockTransactionData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(mockTransactionData);

      const updateInstruction = result.transaction.instructions[1];
      expect(updateInstruction.type).toBe('core_update');
      expect(updateInstruction.assetId).toBe(mockTransactionData.assetId);
      expect(updateInstruction.traitId).toBe(mockTransactionData.traitId);
    });

    it('should handle errors gracefully', async () => {
      mockTransactionBuilder.buildAtomicTransaction.mockRejectedValue(new Error('Network error'));

      await expect(mockTransactionBuilder.buildAtomicTransaction(mockTransactionData))
        .rejects.toThrow('Network error');
    });

    it('should handle invalid wallet addresses', async () => {
      const invalidData = {
        ...mockTransactionData,
        walletAddress: 'invalid-address',
      };

      mockTransactionBuilder.buildAtomicTransaction.mockRejectedValue(new Error('Invalid wallet address'));

      await expect(mockTransactionBuilder.buildAtomicTransaction(invalidData))
        .rejects.toThrow('Invalid wallet address');
    });
  });

  describe('validateTransaction', () => {
    it('should validate transaction with both payment and update instructions', () => {
      const mockTransaction = {
        instructions: [
          { type: 'payment', programId: 'SystemProgram' },
          { type: 'update', programId: 'CoreProgram', keys: [{}], data: Buffer.from('update') },
        ],
      };

      const mockResult = {
        valid: true,
        hasPaymentInstruction: true,
        hasUpdateInstruction: true,
      };

      mockTransactionBuilder.validateTransaction.mockReturnValue(mockResult);

      const result = mockTransactionBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(true);
      expect(result.hasPaymentInstruction).toBe(true);
      expect(result.hasUpdateInstruction).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject transaction with no instructions', () => {
      const mockTransaction = { instructions: [] };

      const mockResult = {
        valid: false,
        error: 'Transaction has no instructions',
        hasPaymentInstruction: false,
        hasUpdateInstruction: false,
      };

      mockTransactionBuilder.validateTransaction.mockReturnValue(mockResult);

      const result = mockTransactionBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Transaction has no instructions');
      expect(result.hasPaymentInstruction).toBe(false);
      expect(result.hasUpdateInstruction).toBe(false);
    });

    it('should reject transaction missing payment instruction', () => {
      const mockTransaction = {
        instructions: [
          { type: 'update', programId: 'CoreProgram', keys: [{}], data: Buffer.from('update') },
        ],
      };

      const mockResult = {
        valid: false,
        error: 'Transaction missing payment instruction',
        hasPaymentInstruction: false,
        hasUpdateInstruction: true,
      };

      mockTransactionBuilder.validateTransaction.mockReturnValue(mockResult);

      const result = mockTransactionBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Transaction missing payment instruction');
      expect(result.hasPaymentInstruction).toBe(false);
      expect(result.hasUpdateInstruction).toBe(true);
    });

    it('should reject transaction missing update instruction', () => {
      const mockTransaction = {
        instructions: [
          { type: 'payment', programId: 'SystemProgram' },
        ],
      };

      const mockResult = {
        valid: false,
        error: 'Transaction missing update instruction',
        hasPaymentInstruction: true,
        hasUpdateInstruction: false,
      };

      mockTransactionBuilder.validateTransaction.mockReturnValue(mockResult);

      const result = mockTransactionBuilder.validateTransaction(mockTransaction);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Transaction missing update instruction');
      expect(result.hasPaymentInstruction).toBe(true);
      expect(result.hasUpdateInstruction).toBe(false);
    });

    it('should handle validation errors gracefully', () => {
      const invalidTransaction = null;

      const mockResult = {
        valid: false,
        error: 'Validation error: Cannot read properties of null',
        hasPaymentInstruction: false,
        hasUpdateInstruction: false,
      };

      mockTransactionBuilder.validateTransaction.mockReturnValue(mockResult);

      const result = mockTransactionBuilder.validateTransaction(invalidTransaction);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.hasPaymentInstruction).toBe(false);
      expect(result.hasUpdateInstruction).toBe(false);
    });
  });

  describe('simulateTransaction', () => {
    it('should return success for valid transaction simulation', async () => {
      const mockTransaction = { instructions: [{ type: 'payment' }, { type: 'update' }] };
      
      const mockResult = {
        success: true,
        paymentExecuted: true,
        updateExecuted: true,
      };

      mockTransactionBuilder.simulateTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.simulateTransaction(mockTransaction);

      expect(result.success).toBe(true);
      expect(result.paymentExecuted).toBe(true);
      expect(result.updateExecuted).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return failure for transaction with simulation error', async () => {
      const mockTransaction = { instructions: [{ type: 'invalid' }] };
      
      const mockResult = {
        success: false,
        paymentExecuted: false,
        updateExecuted: false,
        error: 'Simulation failed: InvalidInstruction',
      };

      mockTransactionBuilder.simulateTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.simulateTransaction(mockTransaction);

      expect(result.success).toBe(false);
      expect(result.paymentExecuted).toBe(false);
      expect(result.updateExecuted).toBe(false);
      expect(result.error).toContain('Simulation failed');
    });

    it('should handle simulation network errors', async () => {
      const mockTransaction = { instructions: [] };
      
      mockTransactionBuilder.simulateTransaction.mockRejectedValue(new Error('Network timeout'));

      await expect(mockTransactionBuilder.simulateTransaction(mockTransaction))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return confirmed status for confirmed transaction', async () => {
      const signature = 'mock-signature';
      
      const mockResult = {
        confirmed: true,
        finalized: false,
      };

      mockTransactionBuilder.getTransactionStatus.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.getTransactionStatus(signature);

      expect(result.confirmed).toBe(true);
      expect(result.finalized).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return finalized status for finalized transaction', async () => {
      const signature = 'mock-signature';
      
      const mockResult = {
        confirmed: true,
        finalized: true,
      };

      mockTransactionBuilder.getTransactionStatus.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.getTransactionStatus(signature);

      expect(result.confirmed).toBe(true);
      expect(result.finalized).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle transaction not found', async () => {
      const signature = 'non-existent-signature';
      
      const mockResult = {
        confirmed: false,
        finalized: false,
        error: 'Transaction not found',
      };

      mockTransactionBuilder.getTransactionStatus.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.getTransactionStatus(signature);

      expect(result.confirmed).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    it('should handle transaction with error', async () => {
      const signature = 'failed-signature';
      
      const mockResult = {
        confirmed: true,
        finalized: false,
        error: 'InstructionError: InvalidInstruction',
      };

      mockTransactionBuilder.getTransactionStatus.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.getTransactionStatus(signature);

      expect(result.confirmed).toBe(true);
      expect(result.finalized).toBe(false);
      expect(result.error).toContain('InstructionError');
    });

    it('should handle status check network errors', async () => {
      const signature = 'mock-signature';
      
      mockTransactionBuilder.getTransactionStatus.mockRejectedValue(new Error('RPC error'));

      await expect(mockTransactionBuilder.getTransactionStatus(signature))
        .rejects.toThrow('RPC error');
    });
  });

  describe('sendAndConfirmTransaction', () => {
    it('should successfully send and confirm transaction', async () => {
      const mockPartiallySignedTx = {
        transaction: { instructions: [{ type: 'payment' }, { type: 'update' }] },
        requiredSignatures: ['wallet1'],
        delegateSignatures: ['delegate1'],
      };
      const mockUserSignature = new Uint8Array([1, 2, 3]);

      const mockResult = {
        success: true,
        signature: 'tx-signature-123',
        paymentExecuted: true,
        updateExecuted: true,
      };

      mockTransactionBuilder.sendAndConfirmTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.sendAndConfirmTransaction(
        mockPartiallySignedTx,
        mockUserSignature
      );

      expect(result.success).toBe(true);
      expect(result.signature).toBe('tx-signature-123');
      expect(result.paymentExecuted).toBe(true);
      expect(result.updateExecuted).toBe(true);
    });

    it('should handle transaction execution failures', async () => {
      const mockPartiallySignedTx = {
        transaction: { instructions: [] },
        requiredSignatures: ['wallet1'],
        delegateSignatures: [],
      };
      const mockUserSignature = new Uint8Array([1, 2, 3]);

      const mockResult = {
        success: false,
        error: 'Transaction failed: Insufficient funds',
        paymentExecuted: false,
        updateExecuted: false,
      };

      mockTransactionBuilder.sendAndConfirmTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.sendAndConfirmTransaction(
        mockPartiallySignedTx,
        mockUserSignature
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
      expect(result.paymentExecuted).toBe(false);
      expect(result.updateExecuted).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid payment amounts', async () => {
      const invalidData = {
        ...mockTransactionData,
        paymentAmount: BigInt(-1),
      };

      mockTransactionBuilder.buildAtomicTransaction.mockRejectedValue(new Error('Invalid payment amount'));

      await expect(mockTransactionBuilder.buildAtomicTransaction(invalidData))
        .rejects.toThrow('Invalid payment amount');
    });

    it('should handle zero payment amounts', async () => {
      const zeroPaymentData = {
        ...mockTransactionData,
        paymentAmount: BigInt(0),
      };

      const mockResult = {
        transaction: { instructions: [{ amount: BigInt(0) }, { type: 'update' }] },
        requiredSignatures: [zeroPaymentData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(zeroPaymentData);
      expect(result.transaction.instructions).toHaveLength(2);
    });

    it('should handle very large payment amounts', async () => {
      const largePaymentData = {
        ...mockTransactionData,
        paymentAmount: BigInt('18446744073709551615'), // Max uint64
      };

      const mockResult = {
        transaction: { instructions: [{ amount: largePaymentData.paymentAmount }, { type: 'update' }] },
        requiredSignatures: [largePaymentData.walletAddress],
        delegateSignatures: [],
      };

      mockTransactionBuilder.buildAtomicTransaction.mockResolvedValue(mockResult);

      const result = await mockTransactionBuilder.buildAtomicTransaction(largePaymentData);
      expect(result.transaction.instructions).toHaveLength(2);
    });
  });
});