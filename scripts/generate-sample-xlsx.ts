import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const columns = ["studentName", "studentId", "diplomaTitle", "issueDate", "recipientAddress", "grade"];
const recipients = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9"
];
const names = ["Salma El Amrani", "Youssef Benali", "Nadia Haddad", "Amine Bennis", "Lina Alaoui", "Mehdi Karim", "Imane Chraibi", "Omar Fassi", "Sara Mansouri", "Rachid Tazi", "Meryem Zahra", "Karim Lahlou"];
const validRows = names.map((studentName, index) => ({
  studentName,
  studentId: `2023-INF-${String(index + 42).padStart(3, "0")}`,
  diplomaTitle: index % 2 === 0 ? "Licence en Informatique" : "Master en Génie Logiciel",
  issueDate: `2025-06-${String(10 + index).padStart(2, "0")}`,
  recipientAddress: recipients[index],
  grade: ["Passable", "Assez Bien", "Bien", "Très Bien"][index % 4]
}));

function writeWorkbook(filename: string, rows: object[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  XLSX.utils.book_append_sheet(workbook, sheet, "Certificats");
  const filePath = path.join(__dirname, "..", "sample-data", filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  XLSX.writeFile(workbook, filePath);
  console.log(`Generated ${filePath}`);
}

writeWorkbook("etudiants.xlsx", validRows);
writeWorkbook("etudiants-invalide.xlsx", [
  validRows[0],
  { ...validRows[1], studentName: "" },
  { ...validRows[2], issueDate: "31/06/2025" },
  { ...validRows[3], recipientAddress: "not-an-address" },
  { ...validRows[4], studentId: validRows[0].studentId }
]);
