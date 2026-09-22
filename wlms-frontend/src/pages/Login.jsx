import {useState} from 'react'
import {Form,Input, Button,Card,message} from 'antd'
import api from "../api/axios"

function Login() {
    const [loading, setLoading] = useState(false);

    const handleLogin = async (values) => {
        setLoading(true);
        try {
            const formData = new URLSearchParams();
            formData.append("username", values.username);
            formData.append("password", values.password);

            const response = await api.post("/auth/login", formData, )

            localStorage.setItem("token", response.data.access_token)
            const me = await api.get("/auth/me")
            localStorage.setItem("user", JSON.stringify(me.data))
            message.success("Login successful");
            window.location.href = "/dashboard";
        }
        catch (error) {
            message.error("invalid username or password");
        }
        finally {
            setLoading(false);
        }
    }
    return (
        <div className="login-page">
            <Card className="login-card" title="WLMS Login">
                <p style={{ color: "#6d7c75", marginBottom: "24px" }}>Warehouse operations, in one clear view.</p>
                <Form layout= "vertical" onFinish={handleLogin}>
                    <Form.Item
                        label="Username"
                        name="username"
                        rules={[{ required: true, message: "Please input your username!" }]}
                    >
                        <Input placeholder="Enter your username" />
                    </Form.Item>
                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: "Please input your password!" }]}
                    >
                        <Input.Password placeholder="Enter your password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block>
                        Sign in
                    </Button>
                </Form>
            </Card>
        </div>
    )
}
export default Login