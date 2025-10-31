// Web3 wallet connection and contract interaction using viem
// This module handles all blockchain interactions on the client side

class Web3Manager {
    constructor() {
        this.walletClient = null;
        this.publicClient = null;
        this.account = null;
        this.isConnected = false;

        // Contract addresses (will be set after deployment)
        this.gameTokenAddress = null;
        this.stakingContractAddress = null;

        // ABIs (will be populated after contract deployment)
        this.gameTokenABI = null;
        this.stakingContractABI = null;

        // Event listeners
        this.onConnectionChange = null;
        this.onBalanceChange = null;
    }

    // Initialize Web3Manager with contract addresses and ABIs
    async initialize(config) {
        this.gameTokenAddress = config.gameTokenAddress;
        this.stakingContractAddress = config.stakingContractAddress;
        this.gameTokenABI = config.gameTokenABI;
        this.stakingContractABI = config.stakingContractABI;

        // Check if wallet is already connected
        if (window.ethereum) {
            const accounts = await window.ethereum.request({
                method: 'eth_accounts'
            });
            if (accounts.length > 0) {
                await this.connectWallet();
            }
        }
    }

    // Connect to user's wallet (MetaMask)
    async connectWallet() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed. Please install MetaMask to play.');
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            this.account = accounts[0];
            this.isConnected = true;

            // Setup event listeners for account/chain changes
            this.setupEventListeners();

            // Notify listeners
            if (this.onConnectionChange) {
                this.onConnectionChange(this.isConnected, this.account);
            }

            console.log('Wallet connected:', this.account);
            return this.account;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    }

    // Disconnect wallet
    disconnectWallet() {
        this.account = null;
        this.isConnected = false;
        this.walletClient = null;
        this.publicClient = null;

        if (this.onConnectionChange) {
            this.onConnectionChange(this.isConnected, null);
        }
    }

    // Setup listeners for wallet events
    setupEventListeners() {
        if (!window.ethereum) return;

        // Handle account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                this.disconnectWallet();
            } else {
                this.account = accounts[0];
                if (this.onConnectionChange) {
                    this.onConnectionChange(this.isConnected, this.account);
                }
                if (this.onBalanceChange) {
                    this.getTokenBalance().then(balance => {
                        this.onBalanceChange(balance);
                    });
                }
            }
        });

        // Handle chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }

    // Get the current network/chain ID
    async getChainId() {
        if (!window.ethereum) throw new Error('Wallet not connected');

        const chainId = await window.ethereum.request({
            method: 'eth_chainId'
        });
        return parseInt(chainId, 16);
    }

    // Switch to a specific network
    async switchNetwork(chainId) {
        if (!window.ethereum) throw new Error('Wallet not connected');

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
        } catch (error) {
            // Chain doesn't exist, add it
            if (error.code === 4902) {
                throw new Error('Please add this network to MetaMask manually');
            }
            throw error;
        }
    }

    // Get game token balance
    async getTokenBalance() {
        if (!this.isConnected || !this.gameTokenAddress) {
            return '0';
        }

        try {
            const data = this.encodeBalanceOf(this.account);

            const balance = await window.ethereum.request({
                method: 'eth_call',
                params: [{
                    to: this.gameTokenAddress,
                    data: data
                }, 'latest']
            });

            // Decode the balance (uint256)
            const balanceValue = BigInt(balance);
            // Convert from wei to tokens (assuming 18 decimals)
            const balanceInTokens = Number(balanceValue) / 1e18;

            return balanceInTokens.toFixed(2);
        } catch (error) {
            console.error('Error getting token balance:', error);
            return '0';
        }
    }

    // Encode balanceOf call
    encodeBalanceOf(address) {
        // balanceOf(address) function selector: 0x70a08231
        const selector = '0x70a08231';
        const paddedAddress = address.slice(2).padStart(64, '0');
        return selector + paddedAddress;
    }

    // Encode approve call
    encodeApprove(spender, amount) {
        // approve(address,uint256) function selector: 0x095ea7b3
        const selector = '0x095ea7b3';
        const paddedSpender = spender.slice(2).padStart(64, '0');
        const paddedAmount = amount.toString(16).padStart(64, '0');
        return selector + paddedSpender + paddedAmount;
    }

    // Approve staking contract to spend tokens
    async approveTokens(amount) {
        if (!this.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            // Convert amount to wei (18 decimals)
            const amountWei = BigInt(Math.floor(amount * 1e18));

            const data = this.encodeApprove(this.stakingContractAddress, amountWei);

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: this.account,
                    to: this.gameTokenAddress,
                    data: data
                }]
            });

            console.log('Approval transaction sent:', txHash);

            // Wait for transaction confirmation
            await this.waitForTransaction(txHash);

            return txHash;
        } catch (error) {
            console.error('Error approving tokens:', error);
            throw error;
        }
    }

    // Stake tokens for a match
    async stakeForMatch(matchId, amount) {
        if (!this.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            // First check if we need approval
            const allowance = await this.getAllowance();
            const amountWei = BigInt(Math.floor(amount * 1e18));

            if (allowance < amountWei) {
                console.log('Insufficient allowance, requesting approval...');
                await this.approveTokens(amount);
            }

            // Encode stakeForMatch(bytes32,uint256) call
            const data = this.encodeStakeForMatch(matchId, amountWei);

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: this.account,
                    to: this.stakingContractAddress,
                    data: data
                }]
            });

            console.log('Stake transaction sent:', txHash);

            // Wait for transaction confirmation
            await this.waitForTransaction(txHash);

            return txHash;
        } catch (error) {
            console.error('Error staking tokens:', error);
            throw error;
        }
    }

    // Get current allowance
    async getAllowance() {
        if (!this.isConnected) return BigInt(0);

        try {
            // allowance(address,address) function selector: 0xdd62ed3e
            const selector = '0xdd62ed3e';
            const paddedOwner = this.account.slice(2).padStart(64, '0');
            const paddedSpender = this.stakingContractAddress.slice(2).padStart(64, '0');
            const data = selector + paddedOwner + paddedSpender;

            const allowance = await window.ethereum.request({
                method: 'eth_call',
                params: [{
                    to: this.gameTokenAddress,
                    data: data
                }, 'latest']
            });

            return BigInt(allowance);
        } catch (error) {
            console.error('Error getting allowance:', error);
            return BigInt(0);
        }
    }

    // Encode stakeForMatch call
    encodeStakeForMatch(matchId, amount) {
        // This will be updated once you provide the actual function signature
        // Assuming: stakeForMatch(bytes32 matchId, uint256 amount)
        // Function selector needs to be calculated from actual contract
        const selector = '0x????????'; // Placeholder - will be updated with actual selector

        // Convert matchId string to bytes32
        const paddedMatchId = matchId.slice(2).padStart(64, '0');
        const paddedAmount = amount.toString(16).padStart(64, '0');

        return selector + paddedMatchId + paddedAmount;
    }

    // Wait for transaction to be mined
    async waitForTransaction(txHash, confirmations = 1) {
        return new Promise((resolve, reject) => {
            let confirmed = false;
            const maxAttempts = 60; // 60 * 2 seconds = 2 minutes timeout
            let attempts = 0;

            const checkTransaction = async () => {
                try {
                    const receipt = await window.ethereum.request({
                        method: 'eth_getTransactionReceipt',
                        params: [txHash]
                    });

                    if (receipt && receipt.blockNumber) {
                        if (!confirmed) {
                            confirmed = true;
                            console.log('Transaction confirmed:', txHash);
                            resolve(receipt);
                        }
                    } else {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('Transaction timeout'));
                        } else {
                            setTimeout(checkTransaction, 2000);
                        }
                    }
                } catch (error) {
                    reject(error);
                }
            };

            checkTransaction();
        });
    }

    // Format address for display (0x1234...5678)
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    // Check if user has enough tokens
    async hasEnoughTokens(amount) {
        const balance = await this.getTokenBalance();
        return parseFloat(balance) >= amount;
    }
}

// Export for use in game.js
window.Web3Manager = Web3Manager;
