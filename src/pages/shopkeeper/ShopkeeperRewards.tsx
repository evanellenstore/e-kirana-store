import { useState } from "react";
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
import ShopkeeperHeader from "../../components/ShopkeeperHeader";
import "./ShopkeeperRewards.css";
import {
  getCustomerByMobile,
  getWalletTransactions,
  getBillingTransactions,
  type Customer,
  type WalletTransaction,
} from "../../services/customerApi";

interface BillTransaction {
  billId: string;
  amount: number;
  discount: number;
  date: string;
  itemCount: number;
}

const ShopkeeperRewards = () => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [billTransactions, setBillTransactions] = useState<BillTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileInput, setMobileInput] = useState<string>("");
  const [searched, setSearched] = useState(false);

  const loadCustomerData = async (mobileNo: string) => {
    if (!mobileNo.trim()) {
      setError("Please enter a mobile number");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const customerRes = await getCustomerByMobile(mobileNo);
      const cust = customerRes.data;
      setCustomer(cust);

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
      setBillTransactions([]);
    } finally {
      setLoading(false);
    }
  };

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
    <Container fluid className="shopkeeper-rewards-container py-4">
      <ShopkeeperHeader 
        title="Customer Wallet & Rewards" 
        description="Quick access to customer wallet balance and billing history for POS"
      />
      <div className="rewards-header mb-4">
        <h2>💳 Customer Rewards</h2>
      </div>

      {/* Search Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <form onSubmit={handleSearch} className="d-flex gap-2">
            <input
              type="text"
              placeholder="Enter customer mobile number"
              value={mobileInput}
              onChange={(e) => setMobileInput(e.target.value)}
              className="form-control"
            />
            <Button variant="success" type="submit">
              🔍 Search
            </Button>
          </form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">⚠️ {error}</Alert>}

      {customer ? (
        <>
          {/* Customer Info Cards */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="text-center bg-success text-white shadow-sm">
                <Card.Body>
                  <Card.Title>Wallet Balance</Card.Title>
                  <h1 className="mb-0">₹{(customer.walletBalance || 0).toFixed(2)}</h1>
                  <small className="mt-2 d-block">Available to use</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="text-center bg-info text-white shadow-sm">
                <Card.Body>
                  <Card.Title>Customer Details</Card.Title>
                  <div className="fs-6">Mobile: <strong>{customer.mobileNo}</strong></div>
                  <small className="mt-2 d-block text-white-50">ID: {customer.id?.substring(0, 12)}</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Wallet Details Card */}
          <Card className="mb-4 shadow-sm">
            <Card.Header className="bg-light">
              <h5 className="mb-0">📊 Wallet Details</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={4} className="border-end">
                  <div className="text-center">
                    <label className="fw-bold text-muted d-block mb-2">Current Balance</label>
                    <h3 className="text-success">₹{(customer.walletBalance || 0).toFixed(2)}</h3>
                  </div>
                </Col>
                <Col md={4} className="border-end">
                  <div className="text-center">
                    <label className="fw-bold text-muted d-block mb-2">Member Since</label>
                    <p className="mb-0">
                      {new Date(customer.createdAt || "").toLocaleDateString()}
                    </p>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="text-center">
                    <label className="fw-bold text-muted d-block mb-2">Total Transactions</label>
                    <h3 className="text-info">{transactions.length}</h3>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Transaction History */}
          <Card className="shadow-sm">
            <Card.Header className="bg-light">
              <h5 className="mb-0">📋 Recent Transactions</h5>
            </Card.Header>
            <Card.Body>
              {transactions.length > 0 ? (
                <div className="table-responsive">
                  <Table striped hover size="sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 10).map((txn, idx) => (
                        <tr key={idx}>
                          <td className="small">
                            {new Date(txn.createdAt || "").toLocaleDateString()}
                          </td>
                          <td>
                            <Badge bg={txn.type === "CREDIT" ? "success" : "danger"}>
                              {txn.type === "CREDIT" ? "✅ CREDIT" : "❌ DEBIT"}
                            </Badge>
                          </td>
                          <td className="fw-bold text-end">
                            <span className={txn.type === "CREDIT" ? "text-success" : "text-danger"}>
                              {txn.type === "CREDIT" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="small">{txn.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {transactions.length > 10 && (
                    <Alert variant="info" className="mt-3 mb-0">
                      Showing 10 of {transactions.length} transactions
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert variant="info" className="mb-0">
                  No wallet transactions found.
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Billing Transactions Tab */}
          <Card className="shadow-sm mt-4">
            <Card.Header className="bg-warning text-dark">
              <strong>🧾 Recent Billing Transactions</strong>
            </Card.Header>
            <Card.Body>
              {billTransactions && billTransactions.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>Bill ID</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Amount</th>
                        <th>Discount/Reward</th>
                        <th>Net Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billTransactions.map((bill) => (
                        <tr key={bill.billId}>
                          <td>
                            <Badge bg="info">{bill.billId}</Badge>
                          </td>
                          <td>{bill.date}</td>
                          <td>
                            <Badge bg="secondary">{bill.itemCount}</Badge>
                          </td>
                          <td>₹{bill.amount.toFixed(2)}</td>
                          <td>
                            <span className="text-success fw-bold">₹{bill.discount.toFixed(2)}</span>
                          </td>
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

          {/* Tips */}
          <Alert variant="success" className="mt-4">
            <strong>💡 Tip:</strong> Share customer's wallet balance with them during billing. 
            They can use it to get discounts on their purchases!
          </Alert>
        </>
      ) : (
        !searched && (
          <Alert variant="info">
            🔍 Search for a customer by mobile number to view their wallet and rewards.
          </Alert>
        )
      )}
    </Container>
  );
};

export default ShopkeeperRewards;
