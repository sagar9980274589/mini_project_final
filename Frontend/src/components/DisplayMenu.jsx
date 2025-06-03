import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';
import { useOrder } from '../OrderContext';
import './DisplayMenu.css';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import Modal from 'react-modal';
import paymentSuccessGif from '../assets/sucess.webm'; // Import the GIF
import paymentSuccessSound from '../assets/sucess.mp3';
import { API_URL } from '../api';

const DisplayMenu = () => {
    useGSAP(() => {
        gsap.from('.menu-item', {
            scaleX: 0,
            scaleY: 0,
            delay: 0.2,
            duration: 0.8,
            opacity: 0,
            scale: 0,
        });
    });

    const { userEmail } = useParams();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const serialNumber = query.get('serial');
    const { readyOrders, clearReadyOrders } = useOrder();
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [quantities, setQuantities] = useState({});
    const [orderSummary, setOrderSummary] = useState(null);
    const [orderId, setOrderId] = useState(null);
    const [orderHistory, setOrderHistory] = useState([]);
    const [orderStatuses, setOrderStatuses] = useState({});
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [showMakePaymentButton, setShowMakePaymentButton] = useState(false);

    useEffect(() => {
        const fetchMenuItems = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/menuItems?userEmail=${userEmail}`);
                setMenuItems(response.data);
                const initialQuantities = {};
                response.data.forEach(item => {
                    initialQuantities[item._id] = 0;
                });
                setQuantities(initialQuantities);
            } catch (err) {
                setError("Error fetching menu items.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMenuItems();
    }, [userEmail]);

    const handleClearOrderHistory = () => {
        setOrderHistory([]);
    };

    const increaseQuantity = (id) => {
        setQuantities(prev => ({ ...prev, [id]: prev[id] + 1 }));
    };

    const decreaseQuantity = (id) => {
        setQuantities(prev => ({
            ...prev,
            [id]: Math.max(0, prev[id] - 1),
        }));
    };

    const removeItem = (id) => {
        setQuantities(prev => ({ ...prev, [id]: 0 }));
    };

    const getOrder = async () => {
        const order = menuItems
            .filter(item => quantities[item._id] > 0)
            .map(item => ({
                name: item.name,
                quantity: quantities[item._id],
                price: item.price,
                total: item.price * quantities[item._id],
            }));
        if (order.length > 0) {
            const uniqueOrderId = `ORD-${Date.now()}`;
            const payload = {
                userEmail,
                items: order,
                orderId: uniqueOrderId,
                serialNumber,
            };
            try {
                await axios.post(`${API_URL}/api/orders`, payload);
                setOrderId(uniqueOrderId);
                setOrderSummary(order);
                setOrderHistory(prev => [
                    ...prev,
                    { orderId: uniqueOrderId, serialNumber, items: order, status: "We are preparing your order" },
                ]);
                const resetQuantities = {};
                menuItems.forEach(item => {
                    resetQuantities[item._id] = 0;
                });
                setQuantities(resetQuantities);
                fetchOrderHistory();

                setPaymentModalOpen(true);
                setShowMakePaymentButton(true);
            } catch (error) {
                console.error('Error saving order:', error);
                setError('Error saving order.');
            }
        } else {
            setOrderSummary(null);
            setError('No items selected for the order.');
        }
    };

    const handleClearOrders = () => {
        clearReadyOrders();
    };

    const fetchOrderHistory = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/orders/history?userEmail=${userEmail}`);
            setOrderHistory(response.data);
        } catch (error) {
            console.error('Error fetching order history:', error.response ? error.response.data : error.message);
        }
    };

    const fetchOrderStatus = async (orderId) => {
        try {
            const response = await axios.get(`${API_URL}/api/orders/${orderId}`);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            } else {
                console.error('Error fetching order status:', error.response ? error.response.data : error.message);
                return null;
            }
        }
    };

    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (orderHistory.length > 0) {
                const newOrderStatuses = {};
                for (const order of orderHistory) {
                    const status = await fetchOrderStatus(order.orderId);
                    newOrderStatuses[order.orderId] = status ? "We are preparing your order" : "Order ready";
                }
                setOrderStatuses(newOrderStatuses);
            }
        }, 10000);
        return () => clearInterval(intervalId);
    }, [orderHistory]);

    if (loading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div className="error">{error}</div>;
    }

    const filteredReadyOrders = readyOrders.filter(order => order.serialNumber === serialNumber);

    const closePaymentModal = () => {
        setPaymentModalOpen(false);
        setPaymentSuccess(false);
        setShowMakePaymentButton(false);
    };

    const handlePayment = () => {
        setShowMakePaymentButton(false);
        setTimeout(() => {
            setPaymentSuccess(true);
        }, 3000);
    };

    return (
        <div className="food-menu">
            <h1>Menu for {userEmail}</h1>
            {menuItems.length === 0 ? (
                <div>No menu items available for this user.</div>
            ) : (
                <div className="menu-items">
                    {menuItems.map(item => (
                        <div key={item._id} className="menu-item">
                            {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="food-image" />}
                            <h3>{item.name}</h3>
                            <p>Price: ₹{item.price.toFixed(2)}</p>
                            <div className="quantity-controls">
                                <button onClick={() => decreaseQuantity(item._id)}>-</button>
                                <span>{quantities[item._id]}</span>
                                <button onClick={() => increaseQuantity(item._id)}>+</button>
                                <button onClick={() => removeItem(item._id)} className="remove-button">Remove</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <button onClick={getOrder} className="get-order">Get Order</button>

            <Modal isOpen={paymentModalOpen} onRequestClose={closePaymentModal} contentLabel="Payment Modal" ariaHideApp={false}>
                <div className="payment-modal">
                    <h2>Google Pay</h2>
                    <div className="payment-details">
                        <p>Processing your payment...</p>
                        {showMakePaymentButton && (
                            <button onClick={handlePayment} className="make-payment-button">
                                Make Payment
                            </button>
                        )}
                        {paymentSuccess && (
                            <div>
                                <p>Payment Successful!</p>
                                <audio
                                    id="payment-success-sound"
                                    src={paymentSuccessSound}
                                    autoPlay
                                >
                                    Your browser does not support the audio element.
                                </audio>
                                <video
                                    width="200"
                                    autoPlay
                                    muted
                                >
                                    <source src={paymentSuccessGif} type="video/webm" />
                                    Your browser does not support the video tag.
                                </video>
                                <br />
                                <button onClick={closePaymentModal}>Close</button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {orderSummary && (
                <div className="order-summary">
                    <h2>Order Summary</h2>
                    <p><strong>Order ID: {orderId}</strong></p>
                    <p><strong>Serial Number: {serialNumber}</strong></p>
                    {orderSummary.map((item, index) => (
                        <div key={index} className="order-item">
                            <p>{item.name} (x{item.quantity}) - ₹{item.total.toFixed(2)}</p>
                        </div>
                    ))}
                    <p><strong>Total: ₹{orderSummary.reduce((acc, item) => acc + item.total, 0).toFixed(2)}</strong></p>
                </div>
            )}

            {filteredReadyOrders.length > 0 && (
                <div className="ready-orders">
                    <h2>Ready Orders</h2>
                    {filteredReadyOrders.map((order, index) => (
                        <div key={index} className="ready-order">
                            <p><strong>Order ID: {order.orderId}</strong></p>
                            <p>Serial Number: {order.serialNumber}</p>
                            <p>Status: {orderStatuses[order.orderId] || "We are preparing your order"}</p>
                            <button className="order-status-button" disabled={true}>
                                Mark as Ready
                            </button>
                        </div>
                    ))}
                    <button onClick={handleClearOrders} className="clear-orders-button">Clear Ready Orders</button>
                </div>
            )}

            {orderHistory.length > 0 && (
                <div className="order-history">
                    <h2>Order History</h2>
                    {orderHistory.map((order, index) => (
                        <div key={index} className="history-order">
                            <p><strong>Order ID: {order.orderId}</strong></p>
                            <p>Serial Number: {order.serialNumber}</p>
                            <p>Status: {orderStatuses[order.orderId] || "We are preparing your order"}</p>
                            <button className="order-status-button" disabled={true}>
                              {orderStatuses[order.orderId] || "We are preparing your order"}
                            </button>
                        </div>
                    ))}
                    <button onClick={handleClearOrderHistory} className="clear-orders-button">Clear Order History</button>
                </div>
            )}
        </div>
    );
};

export default DisplayMenu;
