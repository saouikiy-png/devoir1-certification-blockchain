// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertificateRegistry {
    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
        bool revoked;
    }

    uint256 public constant MAX_BATCH = 15;
    address public immutable owner;
    uint256 private _totalCertificates;
    mapping(address => bool) private _admins;
    mapping(uint256 => Certificate) private _certificates;
    mapping(bytes32 => uint256) private _certIdByStudentId;

    error NotOwner();
    error NotAdmin();
    error InvalidArrayLengths();
    error EmptyBatch();
    error BatchTooLarge(uint256 supplied, uint256 maximum);
    error EmptyRequiredField();
    error DuplicateStudentId(string studentId);
    error CertificateNotFound(uint256 certId);
    error AlreadyRevoked(uint256 certId);
    error InvalidRecipient();

    event AdminUpdated(address indexed account, bool enabled);
    event CertificateMinted(
        uint256 indexed certId,
        string studentId,
        address indexed recipient,
        string studentName,
        string diplomaTitle,
        string issueDate,
        string grade
    );
    event CertificateRevoked(uint256 indexed certId);

    constructor() {
        owner = msg.sender;
        _admins[msg.sender] = true;
        emit AdminUpdated(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (!_admins[msg.sender]) revert NotAdmin();
        _;
    }

    function addAdmin(address account) external onlyOwner {
        if (account == address(0)) revert InvalidRecipient();
        _admins[account] = true;
        emit AdminUpdated(account, true);
    }

    function removeAdmin(address account) external onlyOwner {
        _admins[account] = false;
        emit AdminUpdated(account, false);
    }

    function isAdmin(address account) external view returns (bool) {
        return _admins[account];
    }

    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyAdmin returns (uint256 certId) {
        certId = _mint(to, studentName, studentId, diplomaTitle, issueDate, grade);
    }

    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyAdmin {
        uint256 length = recipients.length;
        if (
            studentNames.length != length ||
            studentIds.length != length ||
            diplomaTitles.length != length ||
            issueDates.length != length ||
            grades.length != length
        ) revert InvalidArrayLengths();
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH) revert BatchTooLarge(length, MAX_BATCH);

        for (uint256 i = 0; i < length; i++) {
            _mint(
                recipients[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i]
            );
        }
    }

    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        if (certId == 0 || certId > _totalCertificates) revert CertificateNotFound(certId);
        return _certificates[certId];
    }

    function getCertIdByStudentId(string calldata studentId) external view returns (uint256) {
        return _certIdByStudentId[keccak256(bytes(studentId))];
    }

    function totalCertificates() external view returns (uint256) {
        return _totalCertificates;
    }

    function revoke(uint256 certId) external onlyAdmin {
        if (certId == 0 || certId > _totalCertificates) revert CertificateNotFound(certId);
        if (_certificates[certId].revoked) revert AlreadyRevoked(certId);
        _certificates[certId].revoked = true;
        emit CertificateRevoked(certId);
    }

    function _mint(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) private returns (uint256 certId) {
        if (
            _isBlank(studentName) ||
            _isBlank(studentId) ||
            _isBlank(diplomaTitle) ||
            _isBlank(issueDate)
        ) revert EmptyRequiredField();
        if (to == address(0)) revert InvalidRecipient();

        bytes32 studentIdHash = keccak256(bytes(studentId));
        if (_certIdByStudentId[studentIdHash] != 0) revert DuplicateStudentId(studentId);

        certId = ++_totalCertificates;
        _certIdByStudentId[studentIdHash] = certId;
        _certificates[certId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            recipient: to,
            revoked: false
        });
        emit CertificateMinted(certId, studentId, to, studentName, diplomaTitle, issueDate, grade);
    }

    function _isBlank(string calldata value) private pure returns (bool) {
        bytes calldata valueBytes = bytes(value);
        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 character = valueBytes[i];
            if (
                character != 0x20 &&
                character != 0x09 &&
                character != 0x0a &&
                character != 0x0d
            ) return false;
        }
        return true;
    }
}
