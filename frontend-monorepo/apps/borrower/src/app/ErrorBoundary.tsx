import { Button, Col, Container, Row } from "react-bootstrap";
import { BiError } from "react-icons/bi";
import { Link, useNavigate } from "react-router-dom";

const ErrorBoundary = () => {
  const navigate = useNavigate();
  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6} className="text-center">
          <div className="d-flex justify-content-center mb-4">
            <BiError size={80} color="#dc3545" />
          </div>
          <h2 className="mb-3">Oops! Something went wrong</h2>
          <p className="mb-4">
            {"We couldn't find what you were looking for."}
          </p>
          <Link to="/">
            <Button variant="primary" onClick={() => navigate("/")}>Home</Button>
          </Link>
        </Col>
      </Row>
    </Container>
  );
};

export default ErrorBoundary;
