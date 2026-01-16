import { useState, useEffect } from 'react';
import { useWallet } from '../../providers/WalletProvider';
import { useConnection } from 'wagmi';
import { base } from 'wagmi/chains';

export const LobbyUI = ({ gameEngine, lobbyState }) => {
    const [incomingChallenges, setIncomingChallenges] = useState([]);
    const [pendingChallenges, setPendingChallenges] = useState([]);
    const [playerId, setPlayerId] = useState(null);
    const [createWagerModal, setCreateWagerModal] = useState<boolean>(false)
    const [wager, setWager] = useState<number>(null)
    const [targetPlayerId, setTargetPlayerId] = useState<string>(null)
    const [isApproving, setIsApproving] = useState<boolean>(false)
    const [isCreatingMatch, setIsCreatingMatch] = useState<boolean>(false)
    const [isAcceptApproving, setIsAcceptApproving] = useState<boolean>(false)
    const [isAcceptingMatch, setIsAcceptingMatch] = useState<boolean>(false)
    const [acceptingChallengeId, setAcceptingChallengeId] = useState<string>(null)
    const [cancellingChallengeId, setCancellingChallengeId] = useState<string>(null)
    const [pendingChallengeData, setPendingChallengeData] = useState(null)

    const {
        wcBalance,
        wcAllowance,
        sendWcApproveTx,
        sendCreateMatchTx,
        sendAcceptMatchTx,
        sendCancelMatchTx
    } = useWallet();

    const connection = useConnection();
    const isWrongChain = connection.chainId !== base.id;

    useEffect(() => {
        if (!gameEngine) return;

        const originalChallengeReceived = gameEngine.onChallengeReceived;
        gameEngine.onChallengeReceived = (challenge) => {
            setIncomingChallenges(prev => [...prev, challenge]);
            if (originalChallengeReceived) originalChallengeReceived(challenge);
        };

        const originalChallengeSent = gameEngine.onChallengeSent;
        gameEngine.onChallengeSent = (data) => {
            // Add the pending challenge with stored data
            setPendingChallenges(prev => {
                // Use pendingChallengeData if available
                const challengeInfo = pendingChallengeData || {};
                return [...prev, {
                    challengeId: data.challengeId,
                    ...challengeInfo
                }];
            });
            setPendingChallengeData(null);
            if (originalChallengeSent) originalChallengeSent(data);
        };

        const originalChallengeResponse = gameEngine.onChallengeResponse;
        gameEngine.onChallengeResponse = (response) => {
            // Only remove from pending challenges when accepted (fight starts)
            // When declined, mark it so user knows to cancel on-chain and reclaim tokens
            if (response.status === 'accepted') {
                setPendingChallenges(prev => prev.filter(c => c.challengeId !== response.challengeId));
            } else if (response.status === 'declined') {
                setPendingChallenges(prev => prev.map(c =>
                    c.challengeId === response.challengeId ? { ...c, status: 'declined' } : c
                ));
            }
            if (originalChallengeResponse) originalChallengeResponse(response);
        };

        const originalChallengeExpired = gameEngine.onChallengeExpired;
        gameEngine.onChallengeExpired = (data) => {
            // Remove from incoming challenges (for the challenged player)
            setIncomingChallenges(prev => prev.filter(c => c.challengeId !== data.challengeId));
            // Mark as expired so challenger knows to cancel on-chain and reclaim tokens
            setPendingChallenges(prev => prev.map(c =>
                c.challengeId === data.challengeId ? { ...c, status: 'expired' } : c
            ));
            if (originalChallengeExpired) originalChallengeExpired(data);
        };

        const originalChallengeCancelled = gameEngine.onChallengeCancelled;
        gameEngine.onChallengeCancelled = (data) => {
            // Remove from incoming challenges when challenger cancels
            setIncomingChallenges(prev => prev.filter(c => c.challengeId !== data.challengeId));
            if (originalChallengeCancelled) originalChallengeCancelled(data);
        };

        const originalFightStarting = gameEngine.onFightStarting;
        gameEngine.onFightStarting = (data) => {
            // Clear all pending challenges when entering a fight
            setPendingChallenges([]);
            setIncomingChallenges([]);
            if (originalFightStarting) originalFightStarting(data);
        };

        setPlayerId(gameEngine.getPlayerId())

        return () => {
            gameEngine.onChallengeReceived = originalChallengeReceived;
            gameEngine.onChallengeSent = originalChallengeSent;
            gameEngine.onChallengeResponse = originalChallengeResponse;
            gameEngine.onChallengeExpired = originalChallengeExpired;
            gameEngine.onChallengeCancelled = originalChallengeCancelled;
            gameEngine.onFightStarting = originalFightStarting;
        };
    }, [gameEngine, pendingChallengeData]);

    const sendWager = async () => {
        if (!wager || isNaN(wager) || wager <= 0) return;
        const targetPlayer = lobbyState?.players?.find(p => p.id === targetPlayerId);

        try {
            if (wcAllowance < wager) {
                setIsApproving(true);
                await sendWcApproveTx(wager);
                setIsApproving(false);
            }

            setIsCreatingMatch(true);
            const result = await sendCreateMatchTx(targetPlayer.walletAddress, wager);

            if (result && result.txHash) {
                // Store challenge data before sending so we can display it in pending list
                setPendingChallengeData({
                    targetPlayerId,
                    targetWallet: targetPlayer.walletAddress,
                    wagerAmount: wager,
                    matchId: result.matchId
                });
                gameEngine.sendChallenge(targetPlayerId, wager, result.matchId);
                setCreateWagerModal(false);
                setWager(null);
                setTargetPlayerId(null);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsApproving(false);
            setIsCreatingMatch(false);
        }
    };

    const cancelWager = () => {
        setCreateWagerModal(false);
        setWager(null);
        setTargetPlayerId(null);
    };

    const handleAcceptChallenge = async (challengeId) => {
        const challenge = incomingChallenges.find(c => c.challengeId === challengeId);
        if (!challenge) return;

        setAcceptingChallengeId(challengeId);

        try {
            // Check if approval is needed for the wager amount
            if (wcAllowance < challenge.wagerAmount) {
                setIsAcceptApproving(true);
                await sendWcApproveTx(challenge.wagerAmount);
                setIsAcceptApproving(false);
            }

            // Accept the match on the blockchain
            if (challenge.matchId !== undefined) {
                setIsAcceptingMatch(true);
                const txHash = await sendAcceptMatchTx(challenge.matchId);
                if (!txHash) {
                    // User rejected or transaction failed
                    return;
                }
            }

            // Then notify the game engine
            gameEngine.acceptChallenge(challengeId);
            setIncomingChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
        } catch (error) {
            console.error('Error accepting challenge:', error);
        } finally {
            setIsAcceptApproving(false);
            setIsAcceptingMatch(false);
            setAcceptingChallengeId(null);
        }
    };

    const handleDeclineChallenge = (challengeId) => {
        gameEngine.declineChallenge(challengeId);
        setIncomingChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
    };

    const handleCancelChallenge = async (challenge) => {
        if (!challenge.matchId) return;

        setCancellingChallengeId(challenge.challengeId);
        try {
            const txHash = await sendCancelMatchTx(challenge.matchId);
            // Only remove from UI if transaction succeeded
            if (!txHash) {
                return;
            }
            // Only notify server if challenge is still pending (not already declined/expired)
            // Server removes the challenge when opponent responds, so it won't be found
            if (!challenge.status) {
                gameEngine.cancelChallenge(challenge.challengeId);
            }
            setPendingChallenges(prev => prev.filter(c => c.challengeId !== challenge.challengeId));
        } catch (error) {
            console.error('Error cancelling challenge:', error);
        } finally {
            setCancellingChallengeId(null);
        }
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <>
            {/* Players Sidebar */}
            <div className="absolute top-0 left-0 w-full max-w-[400px] h-screen overflow-y-auto p-6 z-[100]">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
                        <h3 className="m-0 text-gray-900 text-lg font-semibold">Players in Lobby</h3>
                        <span className="text-gray-600 text-sm font-medium">
                            {lobbyState?.players?.length || 0}/10
                        </span>
                    </div>
                    <div className="space-y-2">
                        {lobbyState?.players?.map(player => (
                            <div
                                key={player.id}
                                className={`bg-gray-50 p-3 rounded-lg flex items-center gap-3 ${
                                    player.id === playerId ? 'ring-2 ring-gray-900' : ''
                                }`}
                            >
                                <span
                                    className="text-xs font-mono text-gray-700 flex-1"
                                    title={player.walletAddress}
                                >
                                    {formatAddress(player.walletAddress)}
                                </span>
                                {player.id === playerId ? (
                                    <span className="text-[10px] text-gray-500 font-medium">(You)</span>
                                ) : player.status === 'fighting' ? (
                                    <span className="text-[10px] text-gray-500 font-medium">(Fighting)</span>
                                ) : (
                                    <button
                                        className="bg-gray-900 hover:bg-gray-600 text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors shadow-sm"
                                        onClick={() => {
                                            setTargetPlayerId(player.id);
                                            setCreateWagerModal(true);
                                        }}
                                    >
                                        Challenge
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Challenges - Below Players List */}
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-5 mt-4">
                    <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
                        <h3 className="m-0 text-gray-900 text-lg font-semibold">Pending Challenges</h3>
                        <span className="text-gray-600 text-sm font-medium">
                            {pendingChallenges.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {pendingChallenges.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-2">No pending challenges</p>
                        ) : (
                            pendingChallenges.map(challenge => (
                                <div
                                    key={challenge.challengeId}
                                    className="bg-gray-50 p-3 rounded-lg flex flex-col gap-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span
                                            className="text-xs font-mono text-gray-700"
                                            title={challenge.targetWallet}
                                        >
                                            Opponent: {' '} {formatAddress(challenge.targetWallet)}
                                        </span>
                                        {challenge.status === 'declined' && (
                                            <span className="text-xs text-red-600 font-medium">Status: Declined</span>
                                        )}
                                        {challenge.status === 'expired' && (
                                            <span className="text-xs text-orange-600 font-medium">Status: Expired</span>
                                        )}
                                        {!challenge.status && (
                                            <span className="text-xs text-yellow-600 font-medium">Status: Pending</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600 font-medium">
                                            Wager: {' '}{challenge.wagerAmount} $MGD
                                        </span>
                                        <button
                                            className="bg-red-600 hover:bg-red-800 text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-xs font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => handleCancelChallenge(challenge)}
                                            disabled={cancellingChallengeId === challenge.challengeId}
                                        >
                                            {cancellingChallengeId === challenge.challengeId ? 'Cancelling...' : 'Cancel'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {/* Incoming Challenges Modal */}
            {incomingChallenges.length > 0 && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="mt-0 mb-6 text-gray-900 text-2xl font-semibold">Incoming Challenges</h2>
                        {incomingChallenges.map(challenge => {
                            const needsApproval = wcAllowance < challenge.wagerAmount;
                            const insufficientBalance = wcBalance < challenge.wagerAmount;
                            const canAccept = !isWrongChain && !insufficientBalance;

                            return (
                                <div key={challenge.challengeId} className="bg-gray-50 p-5 mb-4 rounded-lg border border-gray-200">
                                    <p className="my-2 text-gray-900">
                                        <strong className="font-semibold">
                                            Challenge from{' '}{formatAddress(challenge.challengerWallet)}
                                        </strong>
                                    </p>
                                    <p className="my-2 text-gray-700">Wager: <span className="font-semibold">{challenge.wagerAmount} $MGD</span></p>

                                    {isWrongChain && (
                                        <p className="text-red-600 text-sm my-2 bg-red-50 px-3 py-2 rounded-md">Wrong network - switch to Base</p>
                                    )}

                                    {!isWrongChain && insufficientBalance && (
                                        <p className="text-red-600 text-sm my-2 bg-red-50 px-3 py-2 rounded-md">Insufficient balance</p>
                                    )}

                                    {!isWrongChain && !insufficientBalance && needsApproval && (
                                        <p className="text-yellow-700 text-sm my-2 bg-yellow-50 px-3 py-2 rounded-md">Approval required</p>
                                    )}

                                    <div className="flex gap-3 mt-4">
                                        <button
                                            className="btn-success flex-1"
                                            onClick={() => handleAcceptChallenge(challenge.challengeId)}
                                            disabled={!canAccept || acceptingChallengeId === challenge.challengeId}
                                        >
                                            {acceptingChallengeId === challenge.challengeId
                                                ? (isAcceptApproving ? 'Approving...' : isAcceptingMatch ? 'Accepting...' : 'Accept')
                                                : (needsApproval && canAccept ? 'Approve & Accept' : 'Accept')}
                                        </button>
                                        <button
                                            className="btn-danger flex-1"
                                            onClick={() => handleDeclineChallenge(challenge.challengeId)}
                                            disabled={acceptingChallengeId === challenge.challengeId}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* Create Wager Modal */}
            {createWagerModal && (
                <div className="modal-overlay">
                    <div className="modal-content flex flex-col items-center">
                        <h2 className="mt-0 mb-6 text-gray-900 text-2xl font-semibold">How many $MGD would you like to wager?</h2>
                        <div className="relative w-full mb-4">
                            <input
                                type="number"
                                min="0"
                                value={wager || ''}
                                onChange={(e) => setWager(Number(e.target.value))}
                                placeholder="Enter wager amount"
                                className="input-field pr-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono pointer-events-none">
                                Balance: {wcBalance?.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        {isWrongChain && (
                            <p className="text-red-600 text-sm mb-4 w-full bg-red-50 px-3 py-2 rounded-md">Wrong network - switch to Base</p>
                        )}

                        {wager > 0 && wcBalance < wager && (
                            <p className="text-red-600 text-sm mb-4 w-full bg-red-50 px-3 py-2 rounded-md">Insufficient balance</p>
                        )}

                        {wager > 0 && wcAllowance < wager && wcBalance >= wager && (
                            <p className="text-yellow-700 text-sm mb-4 w-full bg-yellow-50 px-3 py-2 rounded-md">Approval required</p>
                        )}

                        <div className="flex gap-3 w-full">
                            <button
                                className="btn-success flex-1"
                                onClick={sendWager}
                                disabled={isWrongChain || !wager || isNaN(wager) || wager <= 0 || wcBalance < wager || isApproving || isCreatingMatch}
                            >
                                {isApproving ? 'Approving...' : isCreatingMatch ? 'Creating Match...' : (wager > 0 && wcAllowance < wager && wcBalance >= wager) ? 'Approve' : 'Send Challenge'}
                            </button>
                            <button
                                className="btn-danger flex-1"
                                onClick={cancelWager}
                                disabled={isApproving || isCreatingMatch}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
