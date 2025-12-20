import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, TrendingUp, Calendar, Loader2, DollarSign } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './stores/auth';
import { useQuery } from '@tanstack/react-query';

interface Purchase {
  id: string;
  courseId?: string;
  courseTitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: any;
}

interface Payout {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: any;
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Charger les achats
  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery({
    queryKey: ['purchases', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const purchasesQ = query(
        collection(db, 'purchases'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(purchasesQ);
      const purchasesData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const purchase = { id: docSnapshot.id, ...docSnapshot.data() } as Purchase;
          
          // Récupérer le titre du cours si disponible
          if (purchase.courseId && !purchase.courseTitle) {
            try {
              const courseDoc = await getDoc(doc(db, 'courses', purchase.courseId));
              if (courseDoc.exists()) {
                purchase.courseTitle = courseDoc.data().title;
              }
            } catch (error) {
              console.error('Error fetching course title:', error);
            }
          }
          
          return purchase;
        })
      );
      
      return purchasesData;
    },
    enabled: !!user
  });

  // Charger les retraits (pour les formateurs)
  const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['payouts', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const payoutsQ = query(
        collection(db, 'payouts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(payoutsQ);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payout));
    },
    enabled: !!user && (user.role === 'teacher' || user.role === 'admin' || user.isTeacherVerified)
  });

  const formatAmount = (amount?: number) => {
    return ((amount || 0) / 100).toFixed(2);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Complété';
      case 'pending':
        return 'En attente';
      case 'failed':
        return 'Échoué';
      default:
        return status || 'Inconnu';
    }
  };

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.isTeacherVerified;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Connectez-vous pour voir votre historique</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Historique</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Section Achats */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Achats de cours</h2>
          </div>

          {isLoadingPurchases ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : purchases.length > 0 ? (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {purchase.courseTitle || 'Cours inconnu'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                          {getStatusText(purchase.status)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formatDate(purchase.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-lg font-bold text-purple-600">
                        <DollarSign size={16} />
                        <span>{formatAmount(purchase.amount)} {purchase.currency || 'XAF'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun achat</h3>
              <p className="text-gray-600">Vous n'avez pas encore acheté de cours</p>
            </div>
          )}
        </div>

        {/* Section Retraits (formateurs uniquement) */}
        {isTeacher && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Demandes de retrait</h2>
            </div>

            {isLoadingPayouts ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : payouts.length > 0 ? (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div key={payout.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                            {getStatusText(payout.status)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formatDate(payout.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                          <DollarSign size={16} />
                          <span>{formatAmount(payout.amount)} {payout.currency || 'XAF'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune demande de retrait</h3>
                <p className="text-gray-600">Vous n'avez pas encore demandé de retrait</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
