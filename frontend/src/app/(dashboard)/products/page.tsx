'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { PlatformLogo } from '@/components/ui/PlatformLogo';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { 
  Search, 
  Plus, 
  MoreVertical,
  Layers,
  Image as ImageIcon,
  Tag,
  Box,
  RefreshCw,
  Edit2,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/Money';
import api from '@/lib/api';

import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useStores } from '@/components/providers/StoresProvider';
import ConnectPrompt from '@/components/ui/ConnectPrompt';
import { useT } from '@/i18n';

export default function ProductsPage() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const { hasConnectedStore } = useStores();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: any = { per_page: 50 };
      if (search) params.search = search;
      
      const [productsRes, categoriesRes] = await Promise.all([
        api.get('/products', { params }),
        api.get('/categories')
      ]);
      setProducts(productsRes.data.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!hasConnectedStore) {
      toast(t('products.list.toastConnectFirst'), 'info');
      return;
    }
    setIsSyncing(true);
    try {
      // Pass selected ids when any are checked (otherwise syncs all).
      await api.post('/products/sync', selectedIds.length ? { product_ids: selectedIds } : {});
      toast(t('products.list.toastSyncStarted'), 'success');
    } catch (err) {
      console.error('Sync failed', err);
      toast(t('products.list.toastSyncFailed'), 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/products/${deleteId}`);
      setProducts(products.filter(p => p.id !== deleteId));
      setSelectedIds(selectedIds.filter(id => id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error('Delete failed', err);
      toast(t('products.list.toastDeleteFailed'), 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`${t('products.list.bulkDeleteConfirmPrefix')} ${selectedIds.length} ${t('products.list.bulkDeleteConfirmSuffix')}`)) return;
    try {
      // For now, we delete one by one if backend doesn't support bulk delete
      await Promise.all(selectedIds.map(id => api.delete(`/products/${id}`)));
      setProducts(products.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      toast(t('products.list.toastBulkDeleted'), 'success');
    } catch (err) {
      console.error('Bulk delete failed', err);
      toast(t('products.list.toastBulkDeleteFailed'), 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    setIsCreatingCategory(true);
    try {
      const response = await api.post('/categories', { name: newCategoryName });
      setCategories([...categories, response.data]);
      setNewCategoryName('');
    } catch (err) {
      console.error('Failed to create category', err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await api.delete(`/categories/${id}`);
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-black tracking-[-0.025em]">{t('products.list.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('products.list.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            isLoading={isSyncing}
          >
            <RefreshCw size={16} className={cn("me-2", isSyncing && "animate-spin")} />
            {t('products.list.syncProducts')}
          </Button>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => router.push('/products/new')}
          >
            <Plus size={16} className="me-2" />
            {t('products.list.addGlobalProduct')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder={t('products.list.searchPlaceholder')}
            className="ps-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => {router.push('/categories')}}>
            <Tag size={14} className="me-2" />
            {t('products.list.categories')} ({categories.length})
          </Button>
          <div className="relative group">
            <Button variant="ghost" size="sm" className={cn("text-xs", selectedIds.length > 0 && "bg-primary/10 text-primary")}>
              <Layers size={14} className="me-2" />
              {selectedIds.length > 0 ? `${selectedIds.length} ${t('products.list.selectedSuffix')}` : t('products.list.bulkActions')}
            </Button>
            {selectedIds.length > 0 && (
              <div className="absolute top-full end-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                <button 
                  onClick={handleSync}
                  className="w-full px-4 py-3 text-xs text-start hover:bg-accent flex items-center gap-2"
                >
                  <RefreshCw size={12} /> {t('products.list.syncSelected')}
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="w-full px-4 py-3 text-xs text-start hover:bg-destructive/10 text-destructive flex items-center gap-2"
                >
                  <Trash2 size={12} /> {t('products.list.deleteSelected')}
                </button>
                <button 
                  onClick={() => setSelectedIds([])}
                  className="w-full px-4 py-3 text-xs text-start border-t border-border hover:bg-accent"
                >
                  {t('products.list.clearSelection')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl flex items-center justify-between">
          <p className="text-xs font-bold text-primary">{selectedIds.length} {t('products.list.selectedForBulk')}</p>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" onClick={toggleSelectAll}>
              {selectedIds.length === products.length ? t('products.list.deselectAll') : t('products.list.selectAll')}
            </Button>
            <Button size="xs" variant="primary" onClick={handleBulkDelete}>{t('products.list.deleteAll')}</Button>
          </div>
        </div>
      )}

      {!isLoading && !hasConnectedStore && products.length === 0 ? (
        <ConnectPrompt description={t('products.list.connectPromptDesc')} />
      ) : (
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('products.list.loading')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted-foreground">
                  <th className="w-12 ps-5 py-4" />
                  <th className="px-3 py-4 text-start">{t('nav.products')}</th>
                  <th className="px-3 py-4 text-start">{t('products.list.connectedStores')}</th>
                  <th className="px-3 py-4 text-end">{t('products.list.price')}</th>
                  <th className="px-3 py-4 text-end">{t('products.list.stock')}</th>
                  <th className="w-24 pe-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => router.push(`/products/${product.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-accent/40"
                  >
                    <td className="ps-5 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }}>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        selectedIds.includes(product.id) ? "bg-primary border-primary" : "bg-card border-muted-foreground/40"
                      )}>
                        {selectedIds.includes(product.id) && <Plus size={12} className="text-primary-foreground rotate-45" />}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                          {product.image_url
                            ? <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                            : <ImageIcon size={18} />}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-bold">{product.name}</span>
                          <span className="truncate font-mono text-xs text-muted-foreground">{product.sku}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {product.stores?.map((store: any, i: number) => (
                          <span key={i} title={store.name}><PlatformLogo platform={store.platform} size={18} /></span>
                        ))}
                        {!product.stores?.length && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-end font-bold tabular-nums"><Money amount={product.price} /></td>
                    <td className="px-3 py-3 text-end">
                      {product.stock === 0 ? (
                        <span className="rounded-full bg-negative/15 px-2.5 py-1 text-xs font-bold text-negative">{t('products.list.outOfStock')}</span>
                      ) : (
                        <span className={cn("font-bold tabular-nums", product.stock <= 15 ? "text-warning" : "text-foreground")}>{product.stock}</span>
                      )}
                    </td>
                    <td className="pe-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          aria-label="Edit"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); router.push(`/products/${product.id}/edit`); }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          aria-label="Delete"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(product.id); }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!products.length && (
              <button
                onClick={() => router.push('/products/new')}
                className="flex w-full flex-col items-center gap-3 py-16 text-muted-foreground transition-colors hover:text-primary"
              >
                <Plus size={24} />
                <span className="text-sm font-medium">{t('products.list.addNewProduct')}</span>
              </button>
            )}
          </div>
        )}
      </Card>
      )}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={t('products.list.manageCategories')}
      >
        <div className="space-y-6">
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <Input
              placeholder={t('products.list.categoryNamePlaceholder')}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" isLoading={isCreatingCategory}>{t('products.list.add')}</Button>
          </form>

          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border">
                <div className="flex items-center gap-3">
                  <Tag size={14} className="text-primary" />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <button 
                  onClick={() => handleDeleteCategory(category.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">{t('products.list.noCategories')}</p>
            )}
          </div>
          
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>{t('products.list.done')}</Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)}
        title={t('products.list.deleteProductTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('products.list.deleteProductBody')}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('products.list.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('products.list.deleteProductButton')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

