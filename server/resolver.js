// Blockchain resolver service using viem
// Handles match resolution on the WizardsCentralEscrow contract

const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
require('dotenv').config();

// WizardsCentralEscrow contract ABI (minimal - only what we need)
const ESCROW_ABI = [
    {
        name: 'resolveMatch',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'id', type: 'uint256' },
            { name: 'winner', type: 'address' }
        ],
        outputs: []
    },
    {
        name: 'matches',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'uint256' }],
        outputs: [
            { name: 'ID', type: 'uint256' },
            { name: 'player', type: 'address' },
            { name: 'opponent', type: 'address' },
            { name: 'wager', type: 'uint256' },
            { name: 'accepted', type: 'bool' },
            { name: 'resolved', type: 'bool' },
            { name: 'cancelled', type: 'bool' },
            { name: 'winner', type: 'address' }
        ]
    }
];

class MatchResolver {
    constructor() {
        this.publicClient = null;
        this.walletClient = null;
        this.account = null;
        this.escrowAddress = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the resolver with RPC connection and wallet
     */
    async initialize() {
        try {
            // Get config from environment
            const rpcUrl = process.env.RPC_URL || 'https://mainnet.base.org';
            const privateKey = process.env.PRIVATE_KEY;
            this.escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;

            if (!privateKey) {
                console.warn('WARNING: PRIVATE_KEY not set. Running in mock mode.');
                return false;
            }

            if (!this.escrowAddress || this.escrowAddress === 'not_deployed') {
                console.warn('WARNING: ESCROW_CONTRACT_ADDRESS not set. Running in mock mode.');
                return false;
            }

            // Create account from private key
            this.account = privateKeyToAccount(privateKey);

            // Create public client for reading blockchain state
            this.publicClient = createPublicClient({
                chain: base,
                transport: http(rpcUrl)
            });

            // Create wallet client for sending transactions
            this.walletClient = createWalletClient({
                account: this.account,
                chain: base,
                transport: http(rpcUrl)
            });

            this.isInitialized = true;
            console.log('Match Resolver initialized successfully');
            console.log('Resolver address:', this.account.address);
            console.log('Escrow contract:', this.escrowAddress);

            return true;
        } catch (error) {
            console.error('Error initializing Match Resolver:', error);
            return false;
        }
    }

    /**
     * Resolve a match on the blockchain
     * @param {number} matchId - The blockchain match ID
     * @param {string} winnerAddress - Winner's wallet address (or 0x0 for draw/refund)
     * @returns {Promise<{success: boolean, txHash?: string, mock?: boolean}>}
     */
    async resolveMatch(matchId, winnerAddress) {
        // Mock mode if not initialized
        if (!this.isInitialized) {
            console.log('MOCK: Would resolve match', matchId, 'Winner:', winnerAddress);
            return { success: true, mock: true };
        }

        try {
            console.log(`Resolving match ${matchId} on blockchain...`);
            console.log(`Winner: ${winnerAddress || '0x0 (draw/refund)'}`);

            // Validate match state before resolving
            const match = await this.getMatch(matchId);
            if (!match) {
                throw new Error(`Match ${matchId} not found`);
            }

            if (!match.accepted) {
                throw new Error(`Match ${matchId} not accepted yet`);
            }

            if (match.resolved) {
                console.log(`Match ${matchId} already resolved`);
                return { success: true, alreadyResolved: true };
            }

            if (match.cancelled) {
                throw new Error(`Match ${matchId} was cancelled`);
            }

            // Prepare winner address (use zero address for draw/refund)
            const winner = winnerAddress || '0x0000000000000000000000000000000000000000';

            // Simulate the transaction first to catch errors
            await this.publicClient.simulateContract({
                address: this.escrowAddress,
                abi: ESCROW_ABI,
                functionName: 'resolveMatch',
                args: [BigInt(matchId), winner],
                account: this.account
            });

            // Send the transaction
            const hash = await this.walletClient.writeContract({
                address: this.escrowAddress,
                abi: ESCROW_ABI,
                functionName: 'resolveMatch',
                args: [BigInt(matchId), winner],
                account: this.account
            });

            console.log('Match resolution transaction sent:', hash);

            // Wait for transaction confirmation
            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 1
            });

            console.log('Match resolved successfully');
            console.log('Transaction hash:', receipt.transactionHash);
            console.log('Block number:', receipt.blockNumber);
            console.log('Gas used:', receipt.gasUsed.toString());

            return {
                success: true,
                txHash: receipt.transactionHash,
                blockNumber: Number(receipt.blockNumber)
            };
        } catch (error) {
            console.error('Error resolving match:', error);
            throw error;
        }
    }

    /**
     * Get match details from the blockchain
     * @param {number} matchId - The blockchain match ID
     * @returns {Promise<Object|null>} Match details or null if not found
     */
    async getMatch(matchId) {
        if (!this.isInitialized) {
            return null;
        }

        try {
            const result = await this.publicClient.readContract({
                address: this.escrowAddress,
                abi: ESCROW_ABI,
                functionName: 'matches',
                args: [BigInt(matchId)]
            });

            return {
                id: Number(result[0]),
                player: result[1],
                opponent: result[2],
                wager: result[3],
                accepted: result[4],
                resolved: result[5],
                cancelled: result[6],
                winner: result[7]
            };
        } catch (error) {
            console.error('Error getting match details:', error);
            return null;
        }
    }

    /**
     * Check if the resolver is initialized and ready
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Get the resolver wallet address
     * @returns {string|null}
     */
    getResolverAddress() {
        return this.account ? this.account.address : null;
    }
}

// Export singleton instance
const resolver = new MatchResolver();
module.exports = resolver;
