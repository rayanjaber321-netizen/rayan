import { BrowserRouter, Routes, Route } from "react-router-dom";
import FarmCalendar from "./FarmCalendar.jsx";
import AdminGate from "./AdminGate.jsx";
import PublicFarmList from "./PublicFarmList.jsx";
import PublicFarmDetail from "./PublicFarmDetail.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicFarmList />} />
        <Route path="/farm/:farmId" element={<PublicFarmDetail />} />
        <Route
          path="/admin"
          element={
            <AdminGate>
              <FarmCalendar />
            </AdminGate>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
