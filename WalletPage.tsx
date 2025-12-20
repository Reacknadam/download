
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { CountryPhoneInput } from './components/CountryPhoneInput';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';
import { formatPrice, calculateRevenueShare } from './lib/pricing';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { addDoc, serverTimestamp } from 'firebase/firestore';

const WalletPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('orange');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: data } = useQuery({
    queryKey: ['walletData', user?.uid],
    queryFn: async () => {
      if (!user) return null;
      
      const purchasesQ = query(collection(db, 'purchases'), where('teacherId', '==', user.uid));
      const purchasesSnap = await getDocs(purchasesQ);
      
      const totalRevenue = purchasesSnap.docs.reduce((acc, curr) => acc + (curr.data().amount || 0), 0);
      const { teacherShare, platformFee } = calculateRevenueShare(totalRevenue);
      
      const purchases = purchasesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().createdAt?.toDate()
      }));

      return {
        totalRevenue,
        teacherShare,
        platformFee,
        purchases,
        totalStudents: purchasesSnap.size
      };
    },
    enabled: !!user
  });

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }
    
    if (!phoneNumber || phoneNumber.length < 8) {
      alert('Veuillez entrer un numéro de téléphone valide');
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    
    // Validation montant minimum 1 USD et maximum 500 USD
    if (amount < 1) {
      alert('Le montant minimum de retrait est de 1 USD');
      return;
    }
    
    if (amount > 500) {
      alert('Le montant maximum de retrait est de 500 USD');
      return;
    }
    
    if (amount > (data?.teacherShare || 0)) {
      alert('Solde insuffisant');
      return;
    }
    
    // Validation format téléphone RDC (doit commencer par 243)
    const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/[^\d]/g, '');
    if (!cleanPhone.startsWith('243') || cleanPhone.length !== 12) {
      alert('Le numéro de téléphone doit être au format RDC: 243XXXXXXXXX (12 chiffres)');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Mapper les providers frontend vers les providers PawaPay
      const providerMap = {
        'orange': 'ORANGE_COD',
        'airtel': 'AIRTEL_COD',
        'mpesa': 'VODACOM_MPESA_COD'
      };
      
      const response = await fetch('https://jimmy-school.jimmyokoko57.workers.dev/payouts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: user.uid,
          amount: amount,
          phoneNumber: cleanPhone,
          currency: 'USD',
          provider: providerMap[withdrawMethod as keyof typeof providerMap],
          clientReferenceId: `${user.uid}_${Date.now()}`
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.details || result.message || 'Erreur lors du retrait');
      }
      
      setShowSuccess(true);
      setWithdrawAmount('');
      setPhoneNumber('');
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Rafraîchir les données du wallet
      window.location.reload();
      
    } catch (error) {
      console.error('Erreur retrait:', error);
      alert(error.message || 'Une erreur est survenue lors du retrait');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (type: 'support' | 'problem') => {
    if (!message.trim() || !user) return;
    
    setIsSending(true);
    
    try {
      await addDoc(collection(db, 'messages'), {
        type: type,
        message: message.trim(),
        userEmail: user.email,
        userId: user.uid,
        userName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      setMessage('');
      if (type === 'support') {
        setShowSupportModal(false);
      } else {
        setShowProblemModal(false);
      }
      
      // Afficher un message de succès
      alert('Message envoyé avec succès! Nous vous répondrons dans les plus brefs délais.');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Date inconnue';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Info" className="h-12 w-12 text-gray-400 mx-auto mb-4 opacity-50" />
          <p className="text-gray-600">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/teacher')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Wallet</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
          {showSuccess && (
          <div className="mb-6 rounded-2xl bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-3">
              <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Success" className="h-5 w-5" />
              <div>
                <p className="font-semibold text-green-900">Demande de retrait envoyée</p>
                <p className="text-sm text-green-700">Votre retrait sera traité automatiquement via PawaPay</p>
              </div>
            </div>
          </div>
        )}

          <div className="mb-8 rounded-3xl bg-gray-100 p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-gray-600 text-sm mb-2">Solde disponible</p>
              <p className="text-4xl font-bold text-black">{formatPrice(data?.teacherShare || 0)}</p>
            </div>
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
              <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Wallet" className="h-8 w-8" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded-xl p-4">
              <p className="text-gray-600 mb-1">Revenus totaux</p>
              <p className="font-semibold text-black">{formatPrice(data?.totalRevenue || 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-gray-600 mb-1">Fees plateforme (20%)</p>
              <p className="font-semibold text-black">{formatPrice(data?.platformFee || 0)}</p>
            </div>
          </div>
        </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Demander un retrait</h2>
            
            <form onSubmit={handleWithdraw} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant à retirer
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="1"
                    max={Math.min(data?.teacherShare || 0, 500)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Solde disponible: {formatPrice(data?.teacherShare || 0)} | 
                  Min: 1 USD | Max: 500 USD
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Opérateur Mobile Money
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="operator"
                      value="orange"
                      checked={withdrawMethod === 'orange'}
                      onChange={(e) => setWithdrawMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-xl p-4 transition-all ${
                      withdrawMethod === 'orange' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="text-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c8/Orange_logo.svg" alt="Orange Money" className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Orange Money</p>
                      </div>
                    </div>
                  </label>

                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="operator"
                      value="airtel"
                      checked={withdrawMethod === 'airtel'}
                      onChange={(e) => setWithdrawMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-xl p-4 transition-all ${
                      withdrawMethod === 'airtel' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="text-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/3a/Airtel_logo-01.png" alt="Airtel Money" className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Airtel Money</p>
                      </div>
                    </div>
                  </label>

                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="operator"
                      value="mpesa"
                      checked={withdrawMethod === 'mpesa'}
                      onChange={(e) => setWithdrawMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-xl p-4 transition-all ${
                      withdrawMethod === 'mpesa' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="text-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/0/0b/M-PESA.png" alt="M-Pesa" className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">M-Pesa</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de téléphone (format RDC: 243XXXXXXXXX)
                </label>
                <CountryPhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !phoneNumber}
                className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold transition-all hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Traitement en cours...
                  </>
                ) : (
                  'Demander le retrait'
                )}
              </button>
            </form>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => setShowSupportModal(true)}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors"
          >
            <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Support" className="h-8 w-8" />
            <div className="text-left">
              <h4 className="font-bold text-gray-900">Contacter le support</h4>
              <p className="text-sm text-gray-600">Une question ? Un problème ?</p>
            </div>
          </button>
          
          <button 
            onClick={() => setShowProblemModal(true)}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors"
          >
            <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Problem" className="h-8 w-8" />
            <div className="text-left">
              <h4 className="font-bold text-gray-900">Signaler un problème</h4>
              <p className="text-sm text-gray-600">Signaler une transaction ou un bug</p>
            </div>
          </button>
        </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Historique des achats</h2>
          {data?.purchases && data.purchases.length > 0 ? (
            <div className="space-y-4">
              {data.purchases.map((purchase: any) => (
                <div key={purchase.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="User" className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{purchase.studentName || 'Étudiant'}</p>
                        <p className="text-sm text-gray-600">{purchase.courseTitle || 'Achat de cours'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatPrice(purchase.amount || 0)}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Time" className="h-3 w-3" />
                        {formatDate(purchase.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="No purchases" className="h-12 w-12 text-gray-300 mx-auto mb-4 opacity-50" />
              <p className="text-gray-500">Aucun achat pour le moment</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Support */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Contacter le support</h3>
              <button 
                onClick={() => setShowSupportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Close" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-4">
                Une question ? Un problème ? Notre équipe est là pour vous aider.
              </p>
              
              <div className="bg-purple-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-purple-700">
                  <strong>Email:</strong> {user?.email}
                </p>
              </div>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Votre message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre question ou votre problème..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                rows={4}
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSupportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSendMessage('support')}
                disabled={!message.trim() || isSending}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Problème */}
      {showProblemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Signaler un problème</h3>
              <button 
                onClick={() => setShowProblemModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Close" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-4">
                Signalez une transaction, un bug ou tout autre problème technique.
              </p>
              
              <div className="bg-red-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">
                  <strong>Email:</strong> {user?.email}
                </p>
              </div>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description du problème
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez le problème que vous rencontrez..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={4}
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowProblemModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSendMessage('problem')}
                disabled={!message.trim() || isSending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? 'Envoi...' : 'Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
