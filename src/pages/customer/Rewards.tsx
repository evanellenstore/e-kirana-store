import { useContext, useEffect, useState } from "react";
import {
  Container,
  Card,
  Row,
  Col,
  Badge,
  Table,
  Spinner,
  Alert,
  Button,
} from "react-bootstrap";
import { AuthContext } from "../../auth/AuthContext";
import "./Rewards.css";
import {
  getCustomerByMobile,
  getWalletTransactions,
  getBillingTransactions,
  type Customer,
  type WalletTransaction,
} from "../../services/customerApi";

interface BillDetails {
  billId: string;
  totalAmount: number;
  discount: number;
  gst: number;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    itemDiscount?: number;
  }>;
  date: string;
}

interface BillTransaction {
  billId: string;
  amount: number;
  discount: number;
  date: string;
  itemCount: number;
}

const Rewards = () => {
  const auth = useContext(AuthContext);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [billDetails, setBillDetails] = useState<BillDetails[]>([]);
  const [billTransactions, setBillTransactions] = useState<BillTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"wallet" | "transactions" | "bills">("wallet");
  const [mobileInput, setMobileInput] = useState<string>("");
  const [searched, setSearched] = useState(false);

  // Get customer mobile from auth or localStorage
  const getCustomerMobileFromAuth = (): string => {
    return auth?.user?.username || localStorage.getItem("user")?.split('"')[3] || "";
  };

  const loadCustomerData = async (mobileNo: string) => {
    if (!mobileNo.trim()) {
      setError("Please enter a mobile number");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Get customer by mobile
      const customerRes = await getCustomerByMobile(mobileNo);
      const cust = customerRes.data;
      setCustomer(cust);

      // Get wallet transactions
      if (cust.id) {
        try {
          const transRes = await getWalletTransactions(cust.id);
          setTransactions(transRes.data || []);
        } catch (err) {
          console.warn("Could not fetch wallet transactions", err);
          setTransactions([]);
        }

        // Fetch billing transactions from API
        try {
          const billRes = await getBillingTransactions(cust.id);
          const bills = billRes.data || [];
          const mappedBills: BillTransaction[] = bills.map((bill: any) => ({
            billId: bill.billId || `BILL_${bill.id}`,
            amount: bill.totalAmount || 0,
            discount: bill.discount || 0,
            date: bill.billedAt ? new Date(bill.billedAt).toLocaleDateString() : new Date().toLocaleDateString(),
            itemCount: 1
          }));
          setBillTransactions(mappedBills);
        } catch (err) {
          console.warn("Could not fetch billing transactions", err);
          setBillTransactions([]);
        }
      }

      setSearched(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load customer";
      setError(msg);
      setCustomer(null);
      setTransactions([]);
      setBillDetails([]);
      setBillTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Load on component mount
  useEffect(() => {
    const mobileno = getCustomerMobileFromAuth();
    if (mobileno) {
      setMobileInput(mobileno);
      loadCustomerData(mobileno);
    } else {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomerData(mobileInput);
  };

  if (loading && searched) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="customer-rewards-container py-4">
      <div className="rewards-header mb-4">
        <h2>💰 Customer Rewards & Wallet</h2>
      </div>

      {/* Search Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <form onSubmit={handleSearch} className="d-flex gap-2">
            <input
              type="text"
              placeholder="Enter mobile number"
              value={mobileInput}
              onChange={(e) => setMobileInput(e.target.value)}
              className="form-control"
            />
            <Button variant="primary" type="submit">
              Search
            </Button>
          </form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {customer ? (
        <>
          {/* Wallet Summary */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="text-center bg-success text-white">
                <Card.Body>
                  <Card.Title>Wallet Balance</Card.Title>
                  <h2 className="mb-0">₹{(customer.walletBalance || 0).toFixed(2)}</h2>
                  <small className="mt-2 d-block">Available Credits</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center bg-info text-white">
                <Card.Body>
                  <Card.Title>Mobile</Card.Title>
                  <h4 className="mb-0">{customer.mobileNo}</h4>
                  <small className="mt-2 d-block">Customer ID: {customer.id?.substring(0, 8)}</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center bg-warning text-dark">
                <Card.Body>
                  <Card.Title>Transactions</Card.Title>
                  <h2 className="mb-0">{transactions.length}</h2>
                  <small className="mt-2 d-block">Total Credits/Debits</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabs */}
          <div className="mb-4">
            <div className="btn-group" role="group">
              <Button
                variant={activeTab === "wallet" ? "primary" : "outline-primary"}
                onClick={() => setActiveTab("wallet")}
              >
                💳 Wallet Overview
              </Button>
              <Button
                variant={activeTab === "transactions" ? "primary" : "outline-primary"}
                onClick={() => setActiveTab("transactions")}
              >
                📊 Transaction History
              </Button>
              <Button
                variant={activeTab === "bills" ? "primary" : "outline-primary"}
                onClick={() => setActiveTab("bills")}
              >
                📋 Billing Details
              </Button>
            </div>
          </div>

          {/* Wallet Overview Tab */}
          {activeTab === "wallet" && (
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h5 className="mb-0">💳 Wallet Overview</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <label className="fw-bold text-muted">Current Balance</label>
                      <div className="fs-4 text-success">
                        ₹{(customer.walletBalance || 0).toFixed(2)}
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <label className="fw-bold text-muted">Member Since</label>
                      <div className="fs-6">
                        {new Date(customer.createdAt || "").toLocaleDateString() || "N/A"}
                      </div>
                    </div>
                  </Col>
                </Row>
                <div className="alert alert-info mt-3 mb-0">
                  <strong>ℹ️ How it works:</strong> Your wallet stores reward points and discounts
                  earned from purchases. Use your balance at checkout to get discounts!
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Transaction History Tab */}
          {activeTab === "transactions" && (
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h5 className="mb-0">📊 Wallet Transactions</h5>
              </Card.Header>
              <Card.Body>
                {transactions.length > 0 ? (
                  <div className="table-responsive">
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn, idx) => (
                          <tr key={idx}>
                            <td className="small">
                              {new Date(txn.createdAt || "").toLocaleDateString()}
                            </td>
                            <td>
                              <Badge bg={txn.type === "CREDIT" ? "success" : "danger"}>
                                {txn.type}
                              </Badge>
                            </td>
                            <td className="fw-bold">
                              {txn.type === "CREDIT" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                            </td>
                            <td className="small">{txn.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <Alert variant="info" className="mb-0">
                    No transactions yet. Start shopping to earn rewards!
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Billing Details Tab */}
          {activeTab === "bills" && (
            <Card className="mb-4">
              <Card.Header className="bg-light">
                <h5 className="mb-0">📋 Billing Transactions</h5>
              </Card.Header>
              <Card.Body>
                {billTransactions.length > 0 ? (
                  <div className="table-responsive">
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>Bill ID</th>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Discount</th>
                          <th>Net Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billTransactions.map((bill, idx) => (
                          <tr key={idx}>
                            <td>
                              <Badge bg="info">{bill.billId}</Badge>
                            </td>
                            <td className="small">{bill.date}</td>
                            <td>
                              <Badge bg="secondary">{bill.itemCount}</Badge>
                            </td>
                            <td>₹{bill.amount.toFixed(2)}</td>
                            <td className="text-success fw-bold">₹{bill.discount.toFixed(2)}</td>
                            <td className="fw-bold">₹{(bill.amount - bill.discount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <Alert variant="info" className="mb-0">
                    No billing transactions found.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}
        </>
      ) : (
        !searched && (
          <Alert variant="info">
            Enter a mobile number to view customer rewards and wallet details.
          </Alert>
        )
      )}
    </Container>
  );
};

export default Rewards;
