// Server-side Web3 contract interaction using ethers.js
// This module handles match resolution and prize distribution

const { ethers } = require('ethers');
require('dotenv').config();

class ServerWeb3Manager {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.stakingContract = null;
        this.gameTokenContract = null;

        // Contract addresses (will be set from environment variables)
        this.stakingContractAddress = process.env.STAKING_CONTRACT_ADDRESS;
        this.gameTokenAddress = process.env.GAME_TOKEN_ADDRESS;

        // ABIs (will be loaded after contract deployment)
        this.stakingContractABI = null;
        this.gameTokenABI = null;

        // Track pending match resolutions
        this.pendingResolutions = new Map();
    }

    // Initialize the Web3 manager with provider and contracts
    async initialize() {
        try {
            // Setup provider (RPC endpoint)
            const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Setup wallet (server's private key for signing transactions)
            const privateKey = process.env.ORACLE_PRIVATE_KEY;
            if (!privateKey) {
                console.warn('WARNING: ORACLE_PRIVATE_KEY not set. Contract interactions will fail.');
                return false;
            }

            this.wallet = new ethers.Wallet(privateKey, this.provider);
            console.log('Server wallet initialized:', this.wallet.address);

            // Load contract ABIs (these will be populated after contract deployment)
            // For now, we'll define minimal ABIs for the functions we need
            this.stakingContractABI = [
                // resolveMatch(bytes32 matchId, address winner, address loser)
                'function resolveMatch(bytes32 matchId, address winner, address loser) external',
                // refundMatch(bytes32 matchId) - in case both players disconnect
                'function refundMatch(bytes32 matchId) external',
                // getMatchStake(bytes32 matchId) view returns (uint256)
                'function getMatchStake(bytes32 matchId) view returns (uint256)',
                // Event emitted when match is resolved
                'event MatchResolved(bytes32 indexed matchId, address indexed winner, uint256 prize)'
            ];

            // Initialize contracts if addresses are provided
            if (this.stakingContractAddress && this.stakingContractAddress !== 'not_deployed') {
                this.stakingContract = new ethers.Contract(
                    this.stakingContractAddress,
                    this.stakingContractABI,
                    this.wallet
                );
                console.log('Staking contract initialized at:', this.stakingContractAddress);
            } else {
                console.warn('WARNING: STAKING_CONTRACT_ADDRESS not set. Using mock mode.');
            }

            return true;
        } catch (error) {
            console.error('Error initializing ServerWeb3Manager:', error);
            return false;
        }
    }

    // Resolve a match and distribute prizes
    async resolveMatch(matchId, winnerAddress, loserAddress) {
        if (!this.stakingContract) {
            console.log('MOCK: Would resolve match', matchId, 'Winner:', winnerAddress);
            return { success: true, mock: true };
        }

        try {
            console.log(`Resolving match ${matchId}...`);
            console.log(`Winner: ${winnerAddress}, Loser: ${loserAddress}`);

            // Call the smart contract to resolve the match
            const tx = await this.stakingContract.resolveMatch(
                matchId,
                winnerAddress,
                loserAddress
            );

            console.log('Match resolution transaction sent:', tx.hash);

            // Wait for confirmation
            const receipt = await tx.wait();

            console.log('Match resolved successfully. Gas used:', receipt.gasUsed.toString());

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error resolving match:', error);
            throw error;
        }
    }

    // Refund a match (both players get their stake back)
    async refundMatch(matchId) {
        if (!this.stakingContract) {
            console.log('MOCK: Would refund match', matchId);
            return { success: true, mock: true };
        }

        try {
            console.log(`Refunding match ${matchId}...`);

            const tx = await this.stakingContract.refundMatch(matchId);

            console.log('Refund transaction sent:', tx.hash);

            const receipt = await tx.wait();

            console.log('Match refunded successfully. Gas used:', receipt.gasUsed.toString());

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error refunding match:', error);
            throw error;
        }
    }

    // Get the total stake for a match
    async getMatchStake(matchId) {
        if (!this.stakingContract) {
            return ethers.parseEther('0'); // Return 0 in mock mode
        }

        try {
            const stake = await this.stakingContract.getMatchStake(matchId);
            return stake;
        } catch (error) {
            console.error('Error getting match stake:', error);
            return ethers.parseEther('0');
        }
    }

    // Schedule a match resolution with timeout
    scheduleMatchResolution(matchId, player1Address, player2Address, timeoutMs = 300000) {
        const timeout = setTimeout(async () => {
            console.log(`Match ${matchId} timed out. Checking for winner...`);
            // This will be called from the game logic
        }, timeoutMs);

        this.pendingResolutions.set(matchId, {
            timeout,
            player1Address,
            player2Address,
            startTime: Date.now()
        });
    }

    // Cancel a scheduled match resolution
    cancelMatchResolution(matchId) {
        const pending = this.pendingResolutions.get(matchId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingResolutions.delete(matchId);
        }
    }

    // Get pending resolution info
    getPendingResolution(matchId) {
        return this.pendingResolutions.get(matchId);
    }

    // Update contract addresses (useful for testing/development)
    updateContractAddresses(stakingAddress, tokenAddress) {
        this.stakingContractAddress = stakingAddress;
        this.gameTokenAddress = tokenAddress;

        if (stakingAddress && this.wallet) {
            this.stakingContract = new ethers.Contract(
                stakingAddress,
                this.stakingContractABI,
                this.wallet
            );
            console.log('Staking contract updated to:', stakingAddress);
        }
    }

    // Check if contracts are initialized
    isInitialized() {
        return this.stakingContract !== null && this.wallet !== null;
    }

    // Get the server wallet address
    getOracleAddress() {
        return this.wallet ? this.wallet.address : null;
    }
}

// Export singleton instance
const serverWeb3Manager = new ServerWeb3Manager();
module.exports = serverWeb3Manager;
