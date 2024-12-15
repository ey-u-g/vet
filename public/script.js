// Función para eliminar un usuario
function eliminarUsuario(id) {
    id = parseInt(id); // Asegúrate de que id sea un número
    if (confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
        // Enviar una solicitud GET para eliminar el usuario
        fetch(`/eliminar-usuario/${id}`)
            .then(response => response.text())
            .then(data => {
                // Mostrar mensaje y recargar la página para actualizar la lista
                alert("Usuario eliminado correctamente.");
                window.location.href = '/ver-usuarios'; // Redirigir a la lista actualizada
            })
            .catch(error => {
                alert("Error al eliminar el usuario.");
                console.error(error);
            });
    }
}

// Función para eliminar un paciente
function eliminarPaciente(id) {
    id = parseInt(id); // Asegúrate de que id sea un número
    if (confirm("¿Estás seguro de que deseas eliminar este paciente?")) {
        // Enviar una solicitud GET para eliminar el paciente
        fetch(`/eliminar-paciente/${id}`)
            .then(response => response.text())
            .then(data => {
                // Mostrar mensaje y recargar la página para actualizar la lista
                alert("Paciente eliminado correctamente.");
                window.location.href = '/pacientes'; // Redirigir a la lista actualizada
            })
            .catch(error => {
                alert("Error al eliminar el paciente.");
                console.error(error);
            });
    }
}