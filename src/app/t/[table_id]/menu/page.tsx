"use client";

import { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell, Users, ShoppingBag, Receipt, Search, ArrowRight, UserCircle2, Star, Minus, Plus, X, Dices } from 'lucide-react';
import styles from './menu.module.css';

type CartItem = {
  cart_id: string; 
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  notes: string;
};

export default function TableMenu() {
  const params = useParams();
  const router = useRouter();
  const table_id = params.table_id as string;
  
  const [activeCategory, setActiveCategory] = useState('Recomendados');
  const [activeTab, setActiveTab] = useState('menu');
  
  const [dbItems, setDbItems] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>(['Recomendados']);
  const [loadingDb, setLoadingDb] = useState(true);
  
  const [customerName, setCustomerName] = useState('Invitado');

  const [myCart, setMyCart] = useState<CartItem[]>([]);
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');
  const [customizationItem, setCustomizationItem] = useState<any | null>(null);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Estado para el minijuego de pago
  const [showMinigame, setShowMinigame] = useState(false);
  const [minigameWinner, setMinigameWinner] = useState('');

  const loadTableOrders = useCallback(async () => {
    const response = await fetch('/api/table/orders');
    if (response.status === 401) {
      router.replace(`/t/${table_id}`);
      return;
    }
    if (!response.ok) throw new Error('No se pudieron cargar los pedidos de la mesa');
    const payload = await response.json();
    setTableOrders(payload.data);
  }, [router, table_id]);

  useEffect(() => {
    async function loadMenu() {
      const catalogResponse = await fetch('/api/public/catalog');
      const catalog = await catalogResponse.json();
      const catsData = catalogResponse.ok ? catalog.categories : [];
      if (catsData) setDbCategories(catsData.map((c: { name: string }) => c.name));

      const itemsData = catalogResponse.ok ? catalog.items : [];
        
      if (itemsData) {
        const formattedItems = itemsData.map((item: any) => ({
          id: item.id,
          name: item.name,
          desc: item.description,
          price: item.price,
          cat: item.category.name,
          image: item.image_url,
          ingredients: item.modifiable_ingredients ? item.modifiable_ingredients.split(',') : [],
          isFeatured: item.category.name === 'Recomendados'
        }));
        setDbItems(formattedItems);
      }
      setLoadingDb(false);
      
      const sessionResponse = await fetch(`/api/table/session?table_id=${encodeURIComponent(table_id)}`);
      if (!sessionResponse.ok) {
        router.replace(`/t/${table_id}`);
        return;
      }
      const session = await sessionResponse.json();
      setCustomerName(session.name);
      setSessionReady(true);
      await loadTableOrders();
    }
    void loadMenu();
  }, [loadTableOrders, router, table_id]);

  const handleAddClick = (item: any) => {
    if (item.ingredients && item.ingredients.length > 0) {
      setCustomizationItem(item);
      setExcludedIngredients([]);
    } else {
      addToCart(item, '');
    }
  };

  const toggleIngredient = (ingredient: string) => {
    setExcludedIngredients(prev => 
      prev.includes(ingredient) ? prev.filter(i => i !== ingredient) : [...prev, ingredient]
    );
  };

  const confirmCustomization = () => {
    if (!customizationItem) return;
    const notes = excludedIngredients.length > 0 ? `Sin ${excludedIngredients.join(', Sin ')}` : '';
    addToCart(customizationItem, notes);
    setCustomizationItem(null);
  };

  const addToCart = (item: any, notes: string) => {
    setMyCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id && i.notes === notes);
      if (existing) {
        return prev.map(i => i.cart_id === existing.cart_id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { cart_id: Date.now().toString(), menu_item_id: item.id, name: item.name, price: item.price, qty: 1, notes }];
    });
    setToastMessage(`¡${item.name} agregado!`);
    setTimeout(() => setToastMessage(''), 2000);
  };

  const updateQty = (cart_id: string, delta: number) => {
    setMyCart(prev => prev.map(item => {
      if (item.cart_id === cart_id) return { ...item, qty: item.qty + delta };
      return item;
    }).filter(item => item.qty > 0));
  };

  const confirmSendOrder = async () => {
    if (!sessionReady) {
      alert("No hay una sesión activa. Vuelve a escanear el código QR.");
      return;
    }

    try {
      const res = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: myCart })
      });

      if (res.ok) {
        setMyCart([]);
        setIsConfirmModalOpen(false);
        setToastMessage("¡Pedido enviado a cocina!");
        await loadTableOrders();
        setTimeout(() => setToastMessage(''), 2500);
      } else {
        alert("Error al enviar el pedido.");
      }
    } catch (e) {
      alert("Error de conexión.");
    }
  };

  const playRoulette = () => {
    setShowMinigame(true);
    setMinigameWinner('');
    // Simulamos que gira la ruleta y después de 2.5s selecciona a un perdedor/pagador
    setTimeout(() => {
      const players = ['Yo', 'Andrea', 'Juan'];
      const random = players[Math.floor(Math.random() * players.length)];
      setMinigameWinner(random);
    }, 2500);
  };

  const cartItemsCount = myCart.reduce((sum, item) => sum + item.qty, 0);
  const globalTableTotal = myCart.reduce((sum, item) => sum + (item.price * item.qty), 0) + tableOrders.reduce((sum, order) => sum + (order.price * order.qty), 0);

  const renderMenuTab = () => {
    if (loadingDb) return <div className="screen-centered">Cargando menú delicioso...</div>;

    const filteredItems = searchQuery.trim() !== ''
      ? dbItems.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : (activeCategory === 'Recomendados' 
          ? dbItems.filter(item => item.isFeatured)
          : dbItems.filter(item => item.cat === activeCategory || activeCategory === 'Todos'));

    return (
      <>
        {searchQuery.trim() === '' && (
          <div className={styles.categories}>
            {dbCategories.map(cat => (
              <button key={cat} className={`${styles.categoryBtn} ${activeCategory === cat ? styles.active : ''}`} onClick={() => setActiveCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>
        )}
        
        <div className={styles.itemsGrid}>
          {filteredItems.map(item => {
            if (item.isFeatured) {
              return (
                <div key={item.id} className={styles.featuredCard} style={{ backgroundImage: item.image ? `url(${item.image})` : 'linear-gradient(135deg, #28222b, #151216)' }}>
                  <div className={styles.featuredOverlay}>
                    <div className={styles.featuredTag}><Star size={14} fill="currentColor" /> Recomendado del Chef</div>
                    <div className={styles.featuredContent}>
                      <div>
                        <h3 className={styles.featuredName}>{item.name}</h3>
                        <p className={styles.featuredDesc}>{item.desc}</p>
                        <p className={styles.featuredPrice}>${item.price.toFixed(2)}</p>
                      </div>
                      <button className={styles.addButtonLarge} onClick={() => handleAddClick(item)}>Agregar</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemImageContainer}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} className={styles.itemImage} />
                  ) : (
                    <div className={styles.itemImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin imagen</div>
                  )}
                </div>
                <div className={styles.itemInfo}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <p className={styles.itemDesc}>{item.desc}</p>
                  <div className={styles.itemFooter}>
                    <p className={styles.itemPrice}>${item.price.toFixed(2)}</p>
                    <button className={styles.addButtonSmall} onClick={() => handleAddClick(item)}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderCartTab = () => {
    const myTotal = myCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tableTotal = myTotal + tableOrders.reduce((sum, order) => sum + (order.price * order.qty), 0);

    return (
      <div className={`${styles.cartContainer} animate-fade-up`}>
        <h2 className={styles.sectionTitle}>Mi Pedido Actual</h2>
        {myCart.length === 0 ? (
          <div className={styles.emptyCart}>
            <ShoppingBag size={48} color="var(--text-muted)" />
            <p>Aún no has agregado nada.</p>
            <button className="btn-secondary" onClick={() => setActiveTab('menu')} style={{marginTop: '12px'}}>Ver el menú</button>
          </div>
        ) : (
          <>
            <div className={styles.cartList}>
              {myCart.map((item) => (
                <div key={item.cart_id} className={styles.cartItemRow}>
                  <div className={styles.cartItemDetailsInteractive}>
                    <div className={styles.qtyControls}>
                      <button onClick={() => updateQty(item.cart_id, -1)}><Minus size={14}/></button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.cart_id, 1)}><Plus size={14}/></button>
                    </div>
                    <div className={styles.cartItemText}>
                      <span className={styles.cartItemName}>{item.name}</span>
                      {item.notes && <span className={styles.cartItemNotes}>{item.notes}</span>}
                    </div>
                  </div>
                  <span className={styles.cartItemPrice}>${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={styles.cartSummary}>
              <div className={styles.totalRow}>
                <span>Mi Subtotal:</span><strong>${myTotal.toFixed(2)}</strong>
              </div>
              <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setIsConfirmModalOpen(true)}>
                Enviar a Cocina <ArrowRight size={20} />
              </button>
            </div>
          </>
        )}

        <div className={styles.divider}></div>

        <h2 className={styles.sectionTitle}>Pedidos de la Mesa</h2>
        <p className={styles.sectionSubtitle}>Lo que ya se envió a cocina</p>
        
        <div className={styles.tableOrdersList}>
          {tableOrders.map((order, idx) => (
            <div key={idx} className={styles.tableOrderCard}>
              <div className={styles.tableOrderHeader}>
                <UserCircle2 size={18} color="var(--primary)"/>
                <span className={styles.tableOrderUser}>{order.user}</span>
                <span className={styles.statusBadge}>{order.status}</span>
              </div>
              <div className={styles.cartItemRowStatic}>
                <div className={styles.cartItemText}>
                  <span className={styles.cartItemName}>{order.qty}x {order.item}</span>
                  {order.notes && <span className={styles.cartItemNotes}>{order.notes}</span>}
                </div>
                <span className={styles.cartItemPrice}>${(order.price * order.qty).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.tableTotalBadge}>
          Total Acumulado Mesa: <span>${tableTotal.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const renderBillTab = () => {
    const mySentOrders = tableOrders.filter(o => o.user === customerName);
    const myTotal = mySentOrders.reduce((sum, order) => sum + (order.price * order.qty), 0);
    const tableTotal = tableOrders.reduce((sum, order) => sum + (order.price * order.qty), 0);

    return (
      <div className={`${styles.cartContainer} animate-fade-up`}>
        <h2 className={styles.sectionTitle}>Mi Cuenta Personal</h2>
        <p className={styles.sectionSubtitle}>Lo que has consumido y enviado a cocina</p>
        
        {mySentOrders.length === 0 ? (
          <div className={styles.emptyCart}>
            <Receipt size={48} color="var(--text-muted)" />
            <p>Aún no tienes platillos confirmados en cocina.</p>
          </div>
        ) : (
          <div className={styles.cartList}>
            {mySentOrders.map((order, idx) => (
              <div key={idx} className={styles.cartItemRowStatic}>
                <div className={styles.cartItemText}>
                  <span className={styles.cartItemName}>{order.qty}x {order.item}</span>
                  {order.notes && <span className={styles.cartItemNotes}>{order.notes}</span>}
                </div>
                <span className={styles.cartItemPrice}>${(order.price * order.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className={styles.divider} style={{ margin: '8px 0' }}></div>
            <div className={styles.totalRow}>
              <span>Subtotal Mío:</span>
              <strong style={{ color: 'var(--primary)' }}>${myTotal.toFixed(2)}</strong>
            </div>
          </div>
        )}

        <div className={styles.divider}></div>
        <div className={styles.tableTotalBadge}>
          Total Pendiente Mesa: <span>${tableTotal.toFixed(2)}</span>
        </div>

        <h2 className={styles.sectionTitle} style={{marginTop: '24px'}}>¿Cómo desean pagar?</h2>
        
        <div className={styles.paymentOptions}>
          <button className={styles.payBtnNormal} disabled={myTotal === 0}>
            <div>
              <span className={styles.payBtnTitle}>🙋‍♂️ Pagar lo mío</span>
              <span className={styles.payBtnSub}>Paga solo tus consumos</span>
            </div>
            <strong>${myTotal.toFixed(2)}</strong>
          </button>
          
          <button className={styles.payBtnNormal}>
            <div>
              <span className={styles.payBtnTitle}>👑 Pagar por todos</span>
              <span className={styles.payBtnSub}>Invita a toda la mesa</span>
            </div>
            <strong>${tableTotal.toFixed(2)}</strong>
          </button>
          
          <button className={styles.payBtnGame} onClick={playRoulette}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'}}>
              <Dices size={24} />
              <span style={{fontSize: '1.1rem', fontWeight: 700}}>Minijuego: ¿Quién Paga?</span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      {/* Modal Customización */}
      {customizationItem && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-up`}>
            <button className={styles.modalClose} onClick={() => setCustomizationItem(null)}><X size={24} /></button>
            <h2 className={styles.modalTitle}>Personalizar pedido</h2>
            <p className={styles.modalSubtitle}>{customizationItem.name}</p>
            <div className={styles.ingredientsList}>
              <p>Selecciona los ingredientes que <strong>no</strong> deseas:</p>
              {customizationItem.ingredients.map((ing: string) => (
                <button key={ing} className={`${styles.ingredientBtn} ${excludedIngredients.includes(ing) ? styles.ingredientExcluded : ''}`} onClick={() => toggleIngredient(ing)}>
                  Sin {ing}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: '24px' }} onClick={confirmCustomization}>Agregar al pedido</button>
          </div>
        </div>
      )}

      {/* Modal Confirmar Pedido */}
      {isConfirmModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-up`}>
            <button className={styles.modalClose} onClick={() => setIsConfirmModalOpen(false)}><X size={24} /></button>
            <h2 className={styles.modalTitle}>¿Enviar a cocina?</h2>
            <p className={styles.modalSubtitle}>Una vez enviado no podrás modificar tu pedido.</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsConfirmModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={confirmSendOrder}>Sí, Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Minijuego */}
      {showMinigame && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-up`} style={{textAlign: 'center', padding: '48px 24px'}}>
            <button className={styles.modalClose} onClick={() => setShowMinigame(false)}><X size={24} /></button>
            <h2 className={styles.modalTitle} style={{marginBottom: '24px'}}>Ruleta del Destino 🎲</h2>
            
            {!minigameWinner ? (
              <div className={styles.rouletteSpinning}>
                <Dices size={64} className={styles.spinningIcon} color="var(--primary)" />
                <p style={{marginTop: '16px'}}>Eligiendo a la víctima...</p>
              </div>
            ) : (
              <div className="animate-fade-up">
                <div style={{fontSize: '4rem', marginBottom: '16px'}}>😭</div>
                <h3 style={{fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '8px'}}>
                  {minigameWinner === 'Yo' ? '¡Te toca pagar!' : `¡Le toca pagar a ${minigameWinner}!`}
                </h3>
                <p style={{color: 'var(--text-muted)'}}>Prepara la billetera, son ${globalTableTotal.toFixed(2)}</p>
                <button className="btn-primary" style={{ width: '100%', marginTop: '24px' }} onClick={() => setShowMinigame(false)}>
                  Aceptar Destino
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerTop}>
          {!isSearchActive ? (
            <>
              <div>
                <p className={styles.greeting}>Hola, {customerName} 👋</p>
                <h1 className={styles.title}>Mesa {table_id?.slice(0, 4)}</h1>
              </div>
              <div className={styles.searchIcon} onClick={() => setIsSearchActive(true)} style={{cursor: 'pointer'}}>
                <Search size={24} />
              </div>
            </>
          ) : (
            <div className={styles.searchActiveContainer}>
              <Search size={20} color="var(--text-muted)" className={styles.searchInnerIcon} />
              <input 
                type="text" 
                autoFocus
                placeholder="Buscar platillos, ingredientes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} className={styles.searchClose}>
                <X size={24} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {activeTab === 'menu' && renderMenuTab()}
        {activeTab === 'cart' && renderCartTab()}
        {activeTab === 'bill' && renderBillTab()}
        {activeTab === 'table' && (
          <div className="screen-centered">
            <h2 style={{color: 'var(--text-muted)'}}>Próximamente...</h2>
          </div>
        )}
      </main>

      <nav className={styles.bottomNav}>
        <button className={`${styles.navItem} ${activeTab === 'menu' ? styles.activeNav : ''}`} onClick={() => setActiveTab('menu')}>
          <Bell size={24} /><span>Menú</span>
        </button>
        <button className={`${styles.navItem} ${activeTab === 'table' ? styles.activeNav : ''}`} onClick={() => setActiveTab('table')}>
          <Users size={24} /><span>Mesa</span>
        </button>
        <button className={`${styles.navItem} ${activeTab === 'cart' ? styles.activeNav : ''}`} onClick={() => setActiveTab('cart')}>
          <div className={styles.cartIconWrapper}>
            <ShoppingBag size={24} />
            {cartItemsCount > 0 && <span className={styles.badge}>{cartItemsCount}</span>}
          </div>
          <span>Mi Pedido</span>
        </button>
        <button className={`${styles.navItem} ${activeTab === 'bill' ? styles.activeNav : ''}`} onClick={() => setActiveTab('bill')}>
          <Receipt size={24} /><span>Cuenta</span>
        </button>
      </nav>
    </div>
  );
}
